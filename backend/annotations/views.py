from django.db import transaction
from django.db.models import Count, Max
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from core.models import PlatformSetting
from core.section_extractor import extract_sections
from core.settings_views import get_discard_reasons
from core.permissions import IsAnnotator
from datasets.models import Job
from .models import Annotation, AnnotationVersion, DraftAnnotation
from .serializers import (
    JobForAnnotationSerializer,
    MyAnnotationJobsSerializer,
    SaveDraftSerializer,
    SubmitAnnotationSerializer,
)


class AnnotationJobsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    status_counts = None

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        if self.status_counts is not None:
            response.data["status_counts"] = self.status_counts
        return response


class AnnotationViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAnnotator]

    def _get_min_annotation_length(self):
        try:
            setting = PlatformSetting.objects.get(key="min_annotation_length")
            return max(1, int(setting.value))
        except (PlatformSetting.DoesNotExist, ValueError):
            return 1

    def _get_job(self, job_id, user, allowed_statuses=None):
        """Fetch a job and validate assignment. Returns (job, error_response)."""
        try:
            job = Job.objects.select_related("dataset").get(id=job_id)
        except Job.DoesNotExist:
            return None, Response(
                {"detail": "Job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if job.assigned_annotator_id != user.id:
            return None, Response(
                {"detail": "You are not assigned to this job."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if allowed_statuses and job.status not in allowed_statuses:
            return None, Response(
                {"detail": f"Job status '{job.status}' is not valid for this action."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return job, None

    def get_job(self, request, job_id):
        allowed = [
            Job.Status.ASSIGNED_ANNOTATOR,
            Job.Status.ANNOTATION_IN_PROGRESS,
            Job.Status.SUBMITTED_FOR_QA,
            Job.Status.ASSIGNED_QA,
            Job.Status.QA_IN_PROGRESS,
            Job.Status.QA_REJECTED,
            Job.Status.QA_ACCEPTED,
            Job.Status.DELIVERED,
            Job.Status.DISCARDED,
        ]
        job, err = self._get_job(job_id, request.user, allowed)
        if err:
            return err
        min_length = self._get_min_annotation_length()
        serializer = JobForAnnotationSerializer(
            job, context={"min_annotation_length": min_length}
        )
        return Response(serializer.data)

    def get_raw_content(self, request, job_id):
        job, err = self._get_job(job_id, request.user)
        if err:
            return err
        if not job.eml_content:
            return Response(
                {"detail": "Email content not available."},
                status=status.HTTP_404_NOT_FOUND,
            )
        raw_content = job.eml_content
        sections = extract_sections(raw_content)
        return Response({
            "raw_content": raw_content,
            "sections": [
                {
                    "index": s.index,
                    "type": s.section_type,
                    "label": s.label,
                    "content": s.content,
                }
                for s in sections
            ],
        })

    def get_draft(self, request, job_id):
        job, err = self._get_job(job_id, request.user)
        if err:
            return err
        try:
            draft = DraftAnnotation.objects.get(job=job)
            return Response({"annotations": draft.annotations})
        except DraftAnnotation.DoesNotExist:
            return Response({"annotations": []})

    def save_draft(self, request, job_id):
        job, err = self._get_job(
            job_id,
            request.user,
            [Job.Status.ANNOTATION_IN_PROGRESS],
        )
        if err:
            return err
        serializer = SaveDraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        DraftAnnotation.objects.update_or_create(
            job=job,
            defaults={"annotations": serializer.validated_data["annotations"]},
        )
        return Response({"detail": "Draft saved."})

    def start_annotation(self, request, job_id):
        with transaction.atomic():
            try:
                job = (
                    Job.objects.select_for_update()
                    .select_related("dataset")
                    .get(id=job_id)
                )
            except Job.DoesNotExist:
                return Response(
                    {"detail": "Job not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if job.assigned_annotator_id != request.user.id:
                return Response(
                    {"detail": "You are not assigned to this job."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if job.status not in (
                Job.Status.ASSIGNED_ANNOTATOR,
                Job.Status.QA_REJECTED,
            ):
                return Response(
                    {"detail": f"Cannot start annotation from status '{job.status}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            expected_status = request.data.get("expected_status") if hasattr(request, "data") and request.data else None
            if expected_status and job.status != expected_status:
                return Response(
                    {"detail": "Job status has changed. Please refresh."},
                    status=status.HTTP_409_CONFLICT,
                )
            job.status = Job.Status.ANNOTATION_IN_PROGRESS
            job.save(update_fields=["status", "updated_at"])
        return Response({"detail": "Annotation started.", "status": job.status})

    @transaction.atomic
    def submit_annotation(self, request, job_id):
        try:
            job = (
                Job.objects.select_for_update()
                .select_related("dataset")
                .get(id=job_id)
            )
        except Job.DoesNotExist:
            return Response(
                {"detail": "Job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if job.assigned_annotator_id != request.user.id:
            return Response(
                {"detail": "You are not assigned to this job."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if job.status != Job.Status.ANNOTATION_IN_PROGRESS:
            return Response(
                {"detail": f"Cannot submit from status '{job.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        expected_status = request.data.get("expected_status") if hasattr(request, "data") and request.data else None
        if expected_status and job.status != expected_status:
            return Response(
                {"detail": "Job status has changed. Please refresh."},
                status=status.HTTP_409_CONFLICT,
            )
        min_length = self._get_min_annotation_length()
        serializer = SubmitAnnotationSerializer(
            data=request.data,
            context={"min_annotation_length": min_length},
        )
        serializer.is_valid(raise_exception=True)
        annotations_data = serializer.validated_data["annotations"]

        # Determine next version number
        max_version = (
            job.annotation_versions.aggregate(Max("version_number"))[
                "version_number__max"
            ]
            or 0
        )
        version = AnnotationVersion.objects.create(
            job=job,
            version_number=max_version + 1,
            created_by=request.user,
            source=AnnotationVersion.Source.ANNOTATOR,
        )

        # Bulk create annotations
        annotation_objects = [
            Annotation(
                annotation_version=version,
                annotation_class_id=ann["annotation_class"],
                class_name=ann.get("class_name", ""),
                tag=ann.get("tag", ""),
                section_index=ann.get("section_index", 0),
                start_offset=ann["start_offset"],
                end_offset=ann["end_offset"],
                original_text=ann["original_text"],
            )
            for ann in annotations_data
        ]
        Annotation.objects.bulk_create(annotation_objects)

        # Delete draft
        DraftAnnotation.objects.filter(job=job).delete()

        # Update job status
        job.status = Job.Status.SUBMITTED_FOR_QA
        job.save(update_fields=["status", "updated_at"])

        return Response(
            {"detail": "Annotations submitted.", "status": job.status},
            status=status.HTTP_201_CREATED,
        )

    def discard_job(self, request, job_id):
        reason = request.data.get("reason", "").strip()
        if not reason:
            return Response(
                {"detail": "reason is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        valid_reasons = get_discard_reasons()
        if reason not in valid_reasons:
            return Response(
                {"detail": f"Invalid discard reason. Must be one of: {valid_reasons}"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_statuses = (
            Job.Status.ASSIGNED_ANNOTATOR,
            Job.Status.ANNOTATION_IN_PROGRESS,
            Job.Status.QA_REJECTED,
        )

        with transaction.atomic():
            try:
                job = (
                    Job.objects.select_for_update()
                    .select_related("dataset")
                    .get(id=job_id)
                )
            except Job.DoesNotExist:
                return Response(
                    {"detail": "Job not found."},
                    status=status.HTTP_404_NOT_FOUND,
                )
            if job.assigned_annotator_id != request.user.id:
                return Response(
                    {"detail": "You are not assigned to this job."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if job.status not in allowed_statuses:
                return Response(
                    {"detail": f"Cannot discard job with status '{job.status}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            expected_status = request.data.get("expected_status")
            if expected_status and job.status != expected_status:
                return Response(
                    {"detail": "Job status has changed. Please refresh."},
                    status=status.HTTP_409_CONFLICT,
                )

            DraftAnnotation.objects.filter(job=job).delete()

            job.status = Job.Status.DISCARDED
            job.discard_reason = reason
            job.discarded_by = request.user
            job.save(update_fields=["status", "discard_reason", "discarded_by", "updated_at"])

        return Response({"detail": "Job discarded.", "status": job.status})

    def my_jobs(self, request):
        base_queryset = (
            Job.objects.filter(assigned_annotator=request.user)
            .select_related("dataset")
            .order_by("-updated_at")
        )

        # Compute status counts from unfiltered base queryset
        status_counts_qs = (
            Job.objects.filter(assigned_annotator=request.user)
            .values("status")
            .annotate(count=Count("id"))
        )
        status_counts = {row["status"]: row["count"] for row in status_counts_qs}

        # Filters
        queryset = base_queryset
        status_filter = request.query_params.get("status")
        if status_filter:
            statuses = [s.strip() for s in status_filter.split(",") if s.strip()]
            if len(statuses) == 1:
                queryset = queryset.filter(status=statuses[0])
            else:
                queryset = queryset.filter(status__in=statuses)
        search = request.query_params.get("search")
        if search:
            queryset = queryset.filter(file_name__icontains=search)

        paginator = AnnotationJobsPagination()
        paginator.status_counts = status_counts
        page = paginator.paginate_queryset(queryset, request)
        serializer = MyAnnotationJobsSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)
