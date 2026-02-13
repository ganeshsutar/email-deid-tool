import csv
import hashlib
import io
import os
import zipfile
from collections import defaultdict

from django.db import transaction
from django.db.models import Count, OuterRef, Q, Subquery
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from accounts.models import User
from annotations.models import Annotation, AnnotationVersion, DraftAnnotation
from annotations.serializers import AnnotationSerializer
from core.permissions import IsAdmin
from core.section_extractor import extract_sections
from qa.models import QADraftReview

from .models import Dataset, Job
from .serializers import (
    DatasetDetailSerializer,
    DatasetListSerializer,
    DatasetStatusSerializer,
    DatasetUploadSerializer,
    JobDetailSerializer,
    JobSerializer,
)


class DatasetViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]

    def list(self, request):
        queryset = Dataset.objects.select_related("uploaded_by").order_by(
            "-upload_date"
        )

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(name__icontains=search)

        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        datasets = queryset[start:end]

        return Response(
            {
                "count": total,
                "results": DatasetListSerializer(datasets, many=True).data,
            }
        )

    def retrieve(self, request, pk=None):
        try:
            dataset = Dataset.objects.select_related("uploaded_by").get(pk=pk)
        except Dataset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(DatasetDetailSerializer(dataset).data)

    def destroy(self, request, pk=None):
        try:
            dataset = Dataset.objects.get(pk=pk)
        except Dataset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        force = request.query_params.get("force", "").lower() in ("true", "1")
        if not force:
            in_progress = dataset.jobs.filter(
                status__in=[
                    Job.Status.ANNOTATION_IN_PROGRESS,
                    Job.Status.QA_IN_PROGRESS,
                ]
            ).exists()
            if in_progress:
                return Response(
                    {
                        "detail": "Cannot delete dataset with jobs in progress. "
                        "Wait for in-progress jobs to complete first."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        dataset.delete()  # CASCADE deletes jobs
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="upload")
    def upload(self, request):
        serializer = DatasetUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        name = serializer.validated_data["name"]
        file = serializer.validated_data["file"]

        dataset = Dataset.objects.create(
            name=name,
            uploaded_by=request.user,
            status=Dataset.Status.EXTRACTING,
        )

        # Read ZIP into memory buffer
        zip_buffer = io.BytesIO()
        for chunk in file.chunks():
            zip_buffer.write(chunk)

        # Extract inline
        self._extract_dataset(dataset, zip_buffer)

        return Response(
            DatasetDetailSerializer(dataset).data,
            status=status.HTTP_201_CREATED,
        )

    def _extract_dataset(self, dataset, zip_buffer):
        try:
            zip_buffer.seek(0)
            if not zipfile.is_zipfile(zip_buffer):
                dataset.status = Dataset.Status.FAILED
                dataset.error_message = "Uploaded file is not a valid zip archive."
                dataset.save(update_fields=["status", "error_message"])
                return

            zip_buffer.seek(0)
            seen_names = {}
            candidates = []
            seen_hashes_in_zip = set()

            with zipfile.ZipFile(zip_buffer, "r") as zf:
                for entry in zf.namelist():
                    # Skip directories and non-.eml files
                    if entry.endswith("/") or not entry.lower().endswith(".eml"):
                        continue

                    # Use just the filename, not the full path
                    base_name = os.path.basename(entry)
                    if not base_name:
                        continue

                    # Handle duplicate filenames
                    if base_name in seen_names:
                        seen_names[base_name] += 1
                        name_part, ext = os.path.splitext(base_name)
                        base_name = f"{name_part}_{seen_names[base_name]}{ext}"
                    else:
                        seen_names[base_name] = 0

                    # Read .eml content from ZIP and decode
                    raw_bytes = zf.read(entry)
                    content_hash = hashlib.sha256(raw_bytes).hexdigest()

                    # Phase 1: intra-ZIP dedup
                    if content_hash in seen_hashes_in_zip:
                        continue
                    seen_hashes_in_zip.add(content_hash)

                    try:
                        eml_content = raw_bytes.decode("utf-8")
                    except UnicodeDecodeError:
                        eml_content = raw_bytes.decode("latin-1")

                    candidates.append({
                        "file_name": base_name,
                        "eml_content": eml_content,
                        "content_hash": content_hash,
                    })

            # Phase 2: global dedup against existing jobs in the database
            candidate_hashes = {c["content_hash"] for c in candidates}
            existing_hashes = set(
                Job.objects.filter(content_hash__in=candidate_hashes)
                .values_list("content_hash", flat=True)
            )

            # Phase 3: excluded hash blocklist check
            from core.models import ExcludedFileHash
            excluded_hashes = set(
                ExcludedFileHash.objects.filter(content_hash__in=candidate_hashes)
                .values_list("content_hash", flat=True)
            )

            jobs = []
            excluded_count = 0
            for candidate in candidates:
                h = candidate["content_hash"]
                if h in excluded_hashes:
                    excluded_count += 1
                    continue
                if h in existing_hashes:
                    continue
                job = Job(
                    dataset=dataset,
                    file_name=candidate["file_name"],
                    eml_content=candidate["eml_content"],
                    content_hash=candidate["content_hash"],
                    status=Job.Status.UPLOADED,
                )
                jobs.append(job)

            total_extracted = len(seen_hashes_in_zip)
            duplicate_count = total_extracted - len(jobs) - excluded_count

            Job.objects.bulk_create(jobs)
            dataset.status = Dataset.Status.READY
            dataset.file_count = len(jobs)
            dataset.duplicate_count = duplicate_count
            dataset.excluded_count = excluded_count
            dataset.save(update_fields=["status", "file_count", "duplicate_count", "excluded_count"])

        except Exception as e:
            dataset.status = Dataset.Status.FAILED
            dataset.error_message = str(e)
            dataset.save(update_fields=["status", "error_message"])

    @action(detail=True, methods=["get"], url_path="status")
    def dataset_status(self, request, pk=None):
        try:
            dataset = Dataset.objects.get(pk=pk)
        except Dataset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(DatasetStatusSerializer(dataset).data)

    @action(detail=True, methods=["get"], url_path="csv-export")
    def csv_export(self, request, pk=None):
        try:
            dataset = Dataset.objects.get(pk=pk)
        except Dataset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        include_annotations = request.query_params.get(
            "include_annotations", ""
        ).lower() in ("true", "1")

        jobs_qs = (
            Job.objects.filter(dataset=dataset)
            .select_related("assigned_annotator", "assigned_qa", "discarded_by")
            .order_by("file_name")
        )

        safe_name = dataset.name.replace('"', "'")

        if include_annotations:
            filename = f"{safe_name}_jobs_with_annotations.csv"
            columns = [
                "File Name", "Status", "Assigned Annotator", "Assigned QA",
                "Discard Reason", "Discarded By",
                "Class Name", "Tag", "Section", "Start Offset", "End Offset",
                "Original Text", "Annotated By", "Source", "Version",
                "Created At", "Updated At",
            ]

            # Efficiently fetch latest annotations per job
            job_ids = list(jobs_qs.values_list("id", flat=True))
            latest_version_subq = (
                AnnotationVersion.objects.filter(job_id=OuterRef("job_id"))
                .order_by("-version_number")
                .values("id")[:1]
            )
            latest_version_ids = list(
                AnnotationVersion.objects.filter(
                    job_id__in=job_ids,
                    id=Subquery(latest_version_subq),
                ).values_list("id", flat=True)
            )

            annotations_by_job = defaultdict(list)
            for ann in (
                Annotation.objects.filter(
                    annotation_version_id__in=latest_version_ids
                )
                .select_related(
                    "annotation_version",
                    "annotation_version__created_by",
                )
                .order_by("section_index", "start_offset")
            ):
                annotations_by_job[ann.annotation_version.job_id].append(ann)
        else:
            filename = f"{safe_name}_jobs.csv"
            columns = [
                "File Name", "Status", "Assigned Annotator", "Assigned QA",
                "Discard Reason", "Discarded By", "Created At", "Updated At",
            ]

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        writer = csv.writer(response)
        writer.writerow(columns)

        def user_display(user):
            if not user:
                return ""
            return user.email

        for job in jobs_qs.iterator():
            base_row = [
                job.file_name,
                job.get_status_display(),
                user_display(job.assigned_annotator),
                user_display(job.assigned_qa),
                job.discard_reason,
                user_display(job.discarded_by),
            ]

            if include_annotations:
                anns = annotations_by_job.get(job.pk, [])
                if anns:
                    for ann in anns:
                        ver = ann.annotation_version
                        writer.writerow(base_row + [
                            ann.class_name,
                            ann.tag,
                            ann.section_index,
                            ann.start_offset,
                            ann.end_offset,
                            ann.original_text,
                            user_display(ver.created_by),
                            ver.source,
                            ver.version_number,
                            job.created_at.isoformat(),
                            job.updated_at.isoformat(),
                        ])
                else:
                    writer.writerow(base_row + [""] * 9 + [
                        job.created_at.isoformat(),
                        job.updated_at.isoformat(),
                    ])
            else:
                writer.writerow(base_row + [
                    job.created_at.isoformat(),
                    job.updated_at.isoformat(),
                ])

        return response

    @action(detail=True, methods=["get"])
    def jobs(self, request, pk=None):
        try:
            dataset = Dataset.objects.get(pk=pk)
        except Dataset.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        queryset = dataset.jobs.select_related(
            "assigned_annotator", "assigned_qa"
        ).order_by("-created_at")

        status_filter = request.query_params.get("status", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(file_name__icontains=search)

        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        jobs_page = queryset[start:end]

        return Response(
            {
                "count": total,
                "results": JobSerializer(jobs_page, many=True).data,
            }
        )


class JobViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]

    def destroy(self, request, pk=None):
        try:
            job = Job.objects.select_related("dataset").get(pk=pk)
        except Job.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        force = request.query_params.get("force", "").lower() in ("true", "1")
        if not force and job.status in (
            Job.Status.ANNOTATION_IN_PROGRESS,
            Job.Status.QA_IN_PROGRESS,
        ):
            return Response(
                {
                    "detail": "Job is currently in progress. Use ?force=true to delete anyway.",
                    "in_progress": True,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        dataset = job.dataset
        with transaction.atomic():
            job.delete()
            dataset.file_count = dataset.jobs.count()
            dataset.save(update_fields=["file_count"])

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="delete-bulk")
    def delete_bulk(self, request):
        job_ids = request.data.get("job_ids", [])
        force = request.data.get("force", False)

        if not job_ids:
            return Response(
                {"detail": "job_ids is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        jobs = Job.objects.filter(id__in=job_ids).select_related("dataset")

        if not force:
            in_progress_count = jobs.filter(
                status__in=[
                    Job.Status.ANNOTATION_IN_PROGRESS,
                    Job.Status.QA_IN_PROGRESS,
                ]
            ).count()
            if in_progress_count > 0:
                return Response(
                    {
                        "detail": f"{in_progress_count} job(s) are currently in progress. Set force=true to delete anyway.",
                        "in_progress_count": in_progress_count,
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

        with transaction.atomic():
            dataset_ids = set(jobs.values_list("dataset_id", flat=True))
            deleted_count = jobs.count()
            jobs.delete()
            for ds in Dataset.objects.filter(id__in=dataset_ids):
                ds.file_count = ds.jobs.count()
                ds.save(update_fields=["file_count"])

        return Response({"deleted": deleted_count})

    def retrieve(self, request, pk=None):
        try:
            job = Job.objects.select_related(
                "dataset", "assigned_annotator", "assigned_qa"
            ).get(pk=pk)
        except Job.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        return Response(JobDetailSerializer(job).data)

    @action(detail=False, methods=["get"])
    def unassigned(self, request):
        assign_type = request.query_params.get("type", "ANNOTATION").strip()

        if assign_type == "QA":
            queryset = Job.objects.filter(
                status=Job.Status.SUBMITTED_FOR_QA
            ).select_related("dataset", "assigned_annotator", "assigned_qa")
        else:
            queryset = Job.objects.filter(
                status=Job.Status.UPLOADED
            ).select_related("dataset", "assigned_annotator", "assigned_qa")

        dataset_id = request.query_params.get("dataset_id", "").strip()
        if dataset_id:
            queryset = queryset.filter(dataset_id=dataset_id)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(file_name__icontains=search)
                | Q(dataset__name__icontains=search)
            )

        queryset = queryset.order_by("-created_at")

        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        jobs_page = queryset[start:end]

        return Response(
            {
                "count": total,
                "results": JobDetailSerializer(jobs_page, many=True).data,
            }
        )

    @action(detail=False, methods=["get"])
    def assigned(self, request):
        assign_type = request.query_params.get("type", "ANNOTATION").strip()

        if assign_type == "QA":
            queryset = Job.objects.filter(
                status=Job.Status.ASSIGNED_QA
            ).select_related("dataset", "assigned_annotator", "assigned_qa")
        else:
            queryset = Job.objects.filter(
                status=Job.Status.ASSIGNED_ANNOTATOR
            ).select_related("dataset", "assigned_annotator", "assigned_qa")

        dataset_id = request.query_params.get("dataset_id", "").strip()
        if dataset_id:
            queryset = queryset.filter(dataset_id=dataset_id)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(file_name__icontains=search)
                | Q(dataset__name__icontains=search)
            )

        queryset = queryset.order_by("-created_at")

        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        jobs_page = queryset[start:end]

        return Response(
            {
                "count": total,
                "results": JobDetailSerializer(jobs_page, many=True).data,
            }
        )

    @action(detail=False, methods=["get"])
    def workloads(self, request):
        assign_type = request.query_params.get("type", "ANNOTATION").strip()

        if assign_type == "QA":
            workloads = (
                Job.objects.filter(
                    status=Job.Status.ASSIGNED_QA,
                    assigned_qa__isnull=False,
                )
                .values("assigned_qa")
                .annotate(assigned_count=Count("id"))
            )
            return Response(
                [
                    {
                        "user_id": str(w["assigned_qa"]),
                        "assigned_count": w["assigned_count"],
                    }
                    for w in workloads
                ]
            )
        else:
            workloads = (
                Job.objects.filter(
                    status=Job.Status.ASSIGNED_ANNOTATOR,
                    assigned_annotator__isnull=False,
                )
                .values("assigned_annotator")
                .annotate(assigned_count=Count("id"))
            )
            return Response(
                [
                    {
                        "user_id": str(w["assigned_annotator"]),
                        "assigned_count": w["assigned_count"],
                    }
                    for w in workloads
                ]
            )

    @action(detail=False, methods=["post"])
    def assign(self, request):
        job_ids = request.data.get("job_ids", [])
        assignee_id = request.data.get("assignee_id")
        assign_type = request.data.get("type", "ANNOTATION")

        if not job_ids or not assignee_id:
            return Response(
                {"detail": "job_ids and assignee_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            assignee = User.objects.get(pk=assignee_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"detail": "Assignee not found or inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if assign_type == "QA":
            if assignee.role != User.Role.QA:
                return Response(
                    {"detail": "Assignee must have QA role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updated = Job.objects.filter(
                id__in=job_ids,
                status=Job.Status.SUBMITTED_FOR_QA,
            ).update(
                assigned_qa=assignee,
                status=Job.Status.ASSIGNED_QA,
            )
        else:
            if assignee.role != User.Role.ANNOTATOR:
                return Response(
                    {"detail": "Assignee must have ANNOTATOR role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updated = Job.objects.filter(
                id__in=job_ids,
                status=Job.Status.UPLOADED,
            ).update(
                assigned_annotator=assignee,
                status=Job.Status.ASSIGNED_ANNOTATOR,
            )

        return Response({"updated": updated})

    @action(detail=False, methods=["post"], url_path="assign-bulk")
    def assign_bulk(self, request):
        assignments = request.data.get("assignments", [])
        assign_type = request.data.get("type", "ANNOTATION")

        if not assignments:
            return Response(
                {"detail": "assignments list is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        expected_status = (
            Job.Status.SUBMITTED_FOR_QA
            if assign_type == "QA"
            else Job.Status.UPLOADED
        )
        expected_role = User.Role.QA if assign_type == "QA" else User.Role.ANNOTATOR

        total_updated = 0

        with transaction.atomic():
            # Collect unique assignee ids and validate
            assignee_ids = {a["assignee_id"] for a in assignments}
            assignees = {
                str(u.pk): u
                for u in User.objects.filter(
                    pk__in=assignee_ids, is_active=True, role=expected_role
                )
            }

            # Collect all job ids and lock them
            all_job_ids = [a["job_id"] for a in assignments]
            locked_jobs = {
                str(j.pk): j
                for j in Job.objects.select_for_update().filter(
                    pk__in=all_job_ids, status=expected_status
                )
            }

            for assignment in assignments:
                job_id = str(assignment["job_id"])
                assignee_id = str(assignment["assignee_id"])

                job = locked_jobs.get(job_id)
                assignee = assignees.get(assignee_id)

                if not job or not assignee:
                    continue

                if assign_type == "QA":
                    job.assigned_qa = assignee
                    job.status = Job.Status.ASSIGNED_QA
                else:
                    job.assigned_annotator = assignee
                    job.status = Job.Status.ASSIGNED_ANNOTATOR

                job.save(update_fields=["assigned_annotator", "assigned_qa", "status"])
                total_updated += 1

        return Response({"updated": total_updated})

    @action(detail=False, methods=["get"], url_path="in-progress")
    def in_progress(self, request):
        assign_type = request.query_params.get("type", "ANNOTATION").strip()

        if assign_type == "QA":
            queryset = Job.objects.filter(
                status=Job.Status.QA_IN_PROGRESS
            ).select_related("dataset", "assigned_annotator", "assigned_qa")
        else:
            queryset = Job.objects.filter(
                status=Job.Status.ANNOTATION_IN_PROGRESS
            ).select_related("dataset", "assigned_annotator", "assigned_qa")

        dataset_id = request.query_params.get("dataset_id", "").strip()
        if dataset_id:
            queryset = queryset.filter(dataset_id=dataset_id)

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(file_name__icontains=search)
                | Q(dataset__name__icontains=search)
            )

        queryset = queryset.order_by("-created_at")

        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        jobs_page = queryset[start:end]

        return Response(
            {
                "count": total,
                "results": JobDetailSerializer(jobs_page, many=True).data,
            }
        )

    @action(detail=False, methods=["post"])
    def reassign(self, request):
        job_ids = request.data.get("job_ids", [])
        new_assignee_id = request.data.get("new_assignee_id")
        assign_type = request.data.get("type", "ANNOTATION")

        if not job_ids or not new_assignee_id:
            return Response(
                {"detail": "job_ids and new_assignee_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            assignee = User.objects.get(pk=new_assignee_id, is_active=True)
        except User.DoesNotExist:
            return Response(
                {"detail": "Assignee not found or inactive."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if assign_type == "QA":
            if assignee.role != User.Role.QA:
                return Response(
                    {"detail": "Assignee must have QA role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updated = Job.objects.filter(
                id__in=job_ids,
                status__in=[Job.Status.ASSIGNED_QA, Job.Status.QA_IN_PROGRESS],
            ).update(assigned_qa=assignee, status=Job.Status.ASSIGNED_QA)
        else:
            if assignee.role != User.Role.ANNOTATOR:
                return Response(
                    {"detail": "Assignee must have ANNOTATOR role."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            updated = Job.objects.filter(
                id__in=job_ids,
                status__in=[
                    Job.Status.ASSIGNED_ANNOTATOR,
                    Job.Status.ANNOTATION_IN_PROGRESS,
                ],
            ).update(
                assigned_annotator=assignee,
                status=Job.Status.ASSIGNED_ANNOTATOR,
            )

        return Response({"updated": updated})

    @action(detail=True, methods=["get"], url_path="raw-content")
    def raw_content(self, request, pk=None):
        try:
            job = Job.objects.get(pk=pk)
        except Job.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)
        if not job.eml_content:
            return Response(
                {"detail": "Email content not available."},
                status=status.HTTP_404_NOT_FOUND,
            )
        return HttpResponse(job.eml_content, content_type="text/plain; charset=utf-8")

    @action(detail=True, methods=["get"], url_path="annotated-content")
    def annotated_content(self, request, pk=None):
        try:
            job = Job.objects.get(pk=pk)
        except Job.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        latest_version = (
            AnnotationVersion.objects.filter(job=job)
            .order_by("-version_number")
            .first()
        )

        if not latest_version:
            return Response({
                "has_annotations": False,
                "raw_content": job.eml_content or "",
                "sections": [],
                "annotations": [],
            })

        sections = extract_sections(job.eml_content or "")
        annotations = latest_version.annotations.select_related(
            "annotation_class"
        ).all()

        return Response({
            "has_annotations": True,
            "raw_content": job.eml_content or "",
            "sections": [
                {
                    "index": s.index,
                    "type": s.section_type,
                    "label": s.label,
                    "content": s.content,
                }
                for s in sections
            ],
            "annotations": AnnotationSerializer(annotations, many=True).data,
        })

    RESETTABLE_STATUSES = (
        Job.Status.DELIVERED,
        Job.Status.QA_ACCEPTED,
        Job.Status.QA_REJECTED,
        Job.Status.DISCARDED,
    )

    @action(detail=True, methods=["post"])
    def reset(self, request, pk=None):
        expected_status = request.data.get("expected_status")

        with transaction.atomic():
            try:
                job = Job.objects.select_for_update().get(pk=pk)
            except Job.DoesNotExist:
                return Response(status=status.HTTP_404_NOT_FOUND)

            if job.status not in self.RESETTABLE_STATUSES:
                return Response(
                    {"detail": f"Cannot reset job with status {job.status}."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if expected_status and job.status != expected_status:
                return Response(
                    {"detail": "Job status has changed.", "current_status": job.status},
                    status=status.HTTP_409_CONFLICT,
                )

            DraftAnnotation.objects.filter(job=job).delete()
            QADraftReview.objects.filter(job=job).delete()

            job.assigned_annotator = None
            job.assigned_qa = None
            job.status = Job.Status.UPLOADED
            job.discard_reason = ""
            job.discarded_by = None
            job.save(update_fields=["assigned_annotator", "assigned_qa", "status", "discard_reason", "discarded_by"])

        return Response({"status": "reset"})

    @action(detail=False, methods=["post"], url_path="reset-bulk")
    def reset_bulk(self, request):
        job_ids = request.data.get("job_ids", [])

        if not job_ids:
            return Response(
                {"detail": "job_ids is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            jobs = Job.objects.select_for_update().filter(
                id__in=job_ids, status__in=self.RESETTABLE_STATUSES
            )
            job_pks = list(jobs.values_list("pk", flat=True))

            DraftAnnotation.objects.filter(job_id__in=job_pks).delete()
            QADraftReview.objects.filter(job_id__in=job_pks).delete()

            reset_count = jobs.update(
                assigned_annotator=None,
                assigned_qa=None,
                status=Job.Status.UPLOADED,
                discard_reason="",
                discarded_by=None,
            )

        return Response({"reset": reset_count})
