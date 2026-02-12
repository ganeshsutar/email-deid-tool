import os
import uuid
import zipfile

from django.conf import settings
from django.db.models import Count, Q, Subquery, OuterRef, IntegerField
from django.db.models.functions import Coalesce
from django.http import FileResponse
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from annotations.models import Annotation, AnnotationVersion
from annotations.serializers import AnnotationSerializer
from core.permissions import IsAdmin
from core.section_extractor import extract_sections
from core.section_reassembler import (
    deidentify_and_reassemble,
    group_annotations_by_section,
)
from datasets.models import Dataset, Job

from .models import ExportRecord
from .serializers import (
    CreateExportSerializer,
    DatasetWithDeliveredSerializer,
    DeliveredJobSerializer,
    ExportRecordSerializer,
)


class ExportPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class ExportViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]

    def _deidentify_job(self, job):
        """De-identify a job using section-based approach.

        Returns (deidentified_eml_str, annotations_list).
        """
        sections = extract_sections(job.eml_content)
        latest_version = (
            job.annotation_versions.order_by("-version_number").first()
        )
        if not latest_version:
            return job.eml_content, []

        annotations = list(
            latest_version.annotations.select_related(
                "annotation_class"
            ).order_by("section_index", "start_offset")
        )
        anns_by_section = group_annotations_by_section(annotations)
        deidentified = deidentify_and_reassemble(
            job.eml_content, sections, anns_by_section
        )
        return deidentified, annotations

    def list_datasets(self, request):
        datasets = (
            Dataset.objects.annotate(
                delivered_count=Count(
                    "jobs", filter=Q(jobs__status=Job.Status.DELIVERED)
                )
            )
            .filter(delivered_count__gt=0)
            .order_by("name")
        )
        data = [
            {
                "id": ds.id,
                "name": ds.name,
                "delivered_count": ds.delivered_count,
            }
            for ds in datasets
        ]
        return Response(DatasetWithDeliveredSerializer(data, many=True).data)

    def list_delivered_jobs(self, request, dataset_id):
        try:
            dataset = Dataset.objects.get(id=dataset_id)
        except Dataset.DoesNotExist:
            return Response(
                {"detail": "Dataset not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Subquery: get the ID of the latest annotation version per job
        latest_version_subquery = (
            AnnotationVersion.objects.filter(job=OuterRef("pk"))
            .order_by("-version_number")
            .values("id")[:1]
        )

        # Subquery: count annotations for the latest version
        annotation_count_subquery = (
            Annotation.objects.filter(
                annotation_version_id=Subquery(latest_version_subquery)
            )
            .values("annotation_version_id")
            .annotate(cnt=Count("id"))
            .values("cnt")
        )

        jobs = (
            Job.objects.filter(dataset=dataset, status=Job.Status.DELIVERED)
            .select_related("assigned_annotator", "assigned_qa")
            .annotate(
                annotation_count=Coalesce(
                    Subquery(annotation_count_subquery, output_field=IntegerField()),
                    0,
                ),
            )
            .order_by("-updated_at")
        )

        result = [
            {
                "id": job.id,
                "file_name": job.file_name,
                "assigned_annotator": job.assigned_annotator,
                "assigned_qa": job.assigned_qa,
                "annotation_count": job.annotation_count,
                "delivered_date": job.updated_at,
            }
            for job in jobs
        ]
        return Response(DeliveredJobSerializer(result, many=True).data)

    def preview(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id, status=Job.Status.DELIVERED)
        except Job.DoesNotExist:
            return Response(
                {"detail": "Delivered job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not job.eml_content:
            return Response(
                {"detail": "Email content not available."},
                status=status.HTTP_404_NOT_FOUND,
            )

        deidentified, annotations = self._deidentify_job(job)
        sections = extract_sections(job.eml_content)

        return Response(
            {
                "job_id": str(job.id),
                "file_name": job.file_name,
                "original": job.eml_content,
                "deidentified": deidentified,
                "annotations": AnnotationSerializer(annotations, many=True).data,
                "sections": [
                    {
                        "index": s.index,
                        "type": s.section_type,
                        "label": s.label,
                        "content": s.content,
                    }
                    for s in sections
                ],
            }
        )

    def list_exports(self, request):
        queryset = (
            ExportRecord.objects.select_related("dataset", "exported_by")
            .order_by("-exported_at")
        )

        dataset_id = request.query_params.get("dataset_id")
        if dataset_id:
            queryset = queryset.filter(dataset_id=dataset_id)

        paginator = ExportPagination()
        page = paginator.paginate_queryset(queryset, request)

        data = [
            {
                "id": record.id,
                "dataset_name": record.dataset.name,
                "job_count": len(record.job_ids),
                "file_size": record.file_size,
                "exported_by": record.exported_by,
                "exported_at": record.exported_at,
                "download_url": f"/api/exports/{record.id}/download/",
            }
            for record in page
        ]
        serialized = ExportRecordSerializer(data, many=True).data
        return paginator.get_paginated_response(serialized)

    def create_export(self, request):
        serializer = CreateExportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job_ids = serializer.validated_data["job_ids"]

        jobs = Job.objects.filter(id__in=job_ids).select_related("dataset")
        if jobs.count() != len(job_ids):
            return Response(
                {"detail": "One or more jobs not found."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        non_delivered = jobs.exclude(status=Job.Status.DELIVERED)
        if non_delivered.exists():
            return Response(
                {"detail": "All jobs must have DELIVERED status."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # All jobs should be from the same dataset
        dataset_ids = set(jobs.values_list("dataset_id", flat=True))
        if len(dataset_ids) != 1:
            return Response(
                {"detail": "All jobs must belong to the same dataset."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        dataset = jobs.first().dataset
        export_id = uuid.uuid4()
        export_dir = os.path.join(settings.MEDIA_ROOT, "exports", str(export_id))
        os.makedirs(export_dir, exist_ok=True)

        zip_path = os.path.join(export_dir, "export.zip")

        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for job in jobs:
                if not job.eml_content:
                    continue

                deidentified, _ = self._deidentify_job(job)

                short_id = str(job.id)[:8]
                out_name = f"REDACTED_{short_id}_{job.file_name}"
                zf.writestr(out_name, deidentified)

        file_size = os.path.getsize(zip_path)

        record = ExportRecord.objects.create(
            id=export_id,
            dataset=dataset,
            job_ids=[str(jid) for jid in job_ids],
            file_size=file_size,
            file_path=zip_path,
            exported_by=request.user,
        )

        return Response(
            {
                "id": str(record.id),
                "download_url": f"/api/exports/{record.id}/download/",
            },
            status=status.HTTP_201_CREATED,
        )

    def download(self, request, export_id):
        try:
            record = ExportRecord.objects.get(id=export_id)
        except ExportRecord.DoesNotExist:
            return Response(
                {"detail": "Export not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not os.path.exists(record.file_path):
            return Response(
                {"detail": "Export file not found on server."},
                status=status.HTTP_404_NOT_FOUND,
            )

        response = FileResponse(
            open(record.file_path, "rb"),
            as_attachment=True,
            filename=f"export_{str(record.id)[:8]}.zip",
        )
        response["Content-Length"] = os.path.getsize(record.file_path)
        return response
