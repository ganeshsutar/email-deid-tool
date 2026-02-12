import json

from django.db import transaction
from django.db.models import Count, Max
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from annotations.models import Annotation, AnnotationVersion
from core.models import PlatformSetting
from core.section_extractor import extract_sections
from core.permissions import IsQA
from datasets.models import Job
from .models import QADraftReview, QAReviewVersion
from .serializers import (
    AcceptAnnotationSerializer,
    JobForQASerializer,
    MyQAJobsSerializer,
    RejectAnnotationSerializer,
    SaveQADraftSerializer,
)


class QAJobsPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100
    status_counts = None

    def get_paginated_response(self, data):
        response = super().get_paginated_response(data)
        if self.status_counts is not None:
            response.data["status_counts"] = self.status_counts
        return response


class QAViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsQA]

    def _get_blind_review_setting(self):
        try:
            setting = PlatformSetting.objects.get(key="blind_review")
            return setting.value.lower() in ("true", "1", "yes")
        except PlatformSetting.DoesNotExist:
            return False

    def _get_min_annotation_length(self):
        try:
            setting = PlatformSetting.objects.get(key="min_annotation_length")
            return max(1, int(setting.value))
        except (PlatformSetting.DoesNotExist, ValueError):
            return 1

    def _get_job(self, job_id, user, allowed_statuses=None):
        """Fetch a job and validate QA assignment. Returns (job, error_response)."""
        try:
            job = (
                Job.objects.select_related("dataset", "assigned_annotator", "assigned_qa")
                .get(id=job_id)
            )
        except Job.DoesNotExist:
            return None, Response(
                {"detail": "Job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if job.assigned_qa_id != user.id:
            return None, Response(
                {"detail": "You are not assigned as QA for this job."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if allowed_statuses and job.status not in allowed_statuses:
            return None, Response(
                {"detail": f"Job status '{job.status}' is not valid for this action."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return job, None

    def blind_review_setting(self, request):
        enabled = self._get_blind_review_setting()
        return Response({"enabled": enabled})

    def get_job(self, request, job_id):
        allowed = [
            Job.Status.ASSIGNED_QA,
            Job.Status.QA_IN_PROGRESS,
            Job.Status.QA_ACCEPTED,
            Job.Status.QA_REJECTED,
            Job.Status.DELIVERED,
        ]
        job, err = self._get_job(job_id, request.user, allowed)
        if err:
            return err
        blind_review = self._get_blind_review_setting()
        serializer = JobForQASerializer(job, context={"blind_review": blind_review})
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

    def start_qa_review(self, request, job_id):
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
            if job.assigned_qa_id != request.user.id:
                return Response(
                    {"detail": "You are not assigned as QA for this job."},
                    status=status.HTTP_403_FORBIDDEN,
                )
            if job.status != Job.Status.ASSIGNED_QA:
                return Response(
                    {"detail": f"Cannot start QA review from status '{job.status}'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            expected_status = request.data.get("expected_status") if hasattr(request, "data") and request.data else None
            if expected_status and job.status != expected_status:
                return Response(
                    {"detail": "Job status has changed. Please refresh."},
                    status=status.HTTP_409_CONFLICT,
                )
            job.status = Job.Status.QA_IN_PROGRESS
            job.save(update_fields=["status", "updated_at"])
        return Response({"detail": "QA review started.", "status": job.status})

    @transaction.atomic
    def accept_annotation(self, request, job_id):
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
        if job.assigned_qa_id != request.user.id:
            return Response(
                {"detail": "You are not assigned as QA for this job."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if job.status != Job.Status.QA_IN_PROGRESS:
            return Response(
                {"detail": f"Cannot accept from status '{job.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        expected_status = request.data.get("expected_status") if hasattr(request, "data") and request.data else None
        if expected_status and job.status != expected_status:
            return Response(
                {"detail": "Job status has changed. Please refresh."},
                status=status.HTTP_409_CONFLICT,
            )

        min_length = self._get_min_annotation_length()
        serializer = AcceptAnnotationSerializer(
            data=request.data,
            context={"min_annotation_length": min_length},
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Get latest annotation version
        latest_annotation_version = (
            job.annotation_versions.order_by("-version_number").first()
        )
        if not latest_annotation_version:
            return Response(
                {"detail": "No annotation version found for this job."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If QA made modifications, create a new annotation version
        if data.get("modified_annotations"):
            max_version = (
                job.annotation_versions.aggregate(Max("version_number"))[
                    "version_number__max"
                ]
                or 0
            )
            qa_version = AnnotationVersion.objects.create(
                job=job,
                version_number=max_version + 1,
                created_by=request.user,
                source=AnnotationVersion.Source.QA,
            )
            annotation_objects = [
                Annotation(
                    annotation_version=qa_version,
                    annotation_class_id=ann["annotation_class"],
                    class_name=ann.get("class_name", ""),
                    tag=ann.get("tag", ""),
                    section_index=ann.get("section_index", 0),
                    start_offset=ann["start_offset"],
                    end_offset=ann["end_offset"],
                    original_text=ann["original_text"],
                )
                for ann in data["modified_annotations"]
            ]
            Annotation.objects.bulk_create(annotation_objects)
            review_annotation_version = qa_version
        else:
            review_annotation_version = latest_annotation_version

        # Create QA review version
        max_qa_version = (
            job.qa_reviews.aggregate(Max("version_number"))[
                "version_number__max"
            ]
            or 0
        )
        QAReviewVersion.objects.create(
            job=job,
            version_number=max_qa_version + 1,
            annotation_version=review_annotation_version,
            reviewed_by=request.user,
            decision=QAReviewVersion.Decision.ACCEPT,
            comments=data.get("comments", ""),
            modifications_summary=json.dumps(data.get("modifications", [])),
        )

        job.status = Job.Status.DELIVERED
        job.save(update_fields=["status", "updated_at"])

        # Clean up QA draft if exists
        QADraftReview.objects.filter(job=job).delete()

        return Response(
            {"detail": "Annotation accepted.", "status": job.status},
            status=status.HTTP_201_CREATED,
        )

    @transaction.atomic
    def reject_annotation(self, request, job_id):
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
        if job.assigned_qa_id != request.user.id:
            return Response(
                {"detail": "You are not assigned as QA for this job."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if job.status != Job.Status.QA_IN_PROGRESS:
            return Response(
                {"detail": f"Cannot reject from status '{job.status}'."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        expected_status = request.data.get("expected_status") if hasattr(request, "data") and request.data else None
        if expected_status and job.status != expected_status:
            return Response(
                {"detail": "Job status has changed. Please refresh."},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = RejectAnnotationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        # Get latest annotation version
        latest_annotation_version = (
            job.annotation_versions.order_by("-version_number").first()
        )
        if not latest_annotation_version:
            return Response(
                {"detail": "No annotation version found for this job."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_qa_version = (
            job.qa_reviews.aggregate(Max("version_number"))[
                "version_number__max"
            ]
            or 0
        )
        QAReviewVersion.objects.create(
            job=job,
            version_number=max_qa_version + 1,
            annotation_version=latest_annotation_version,
            reviewed_by=request.user,
            decision=QAReviewVersion.Decision.REJECT,
            comments=data["comments"],
            modifications_summary=json.dumps(data.get("annotation_notes", {})),
        )

        job.status = Job.Status.QA_REJECTED
        job.save(update_fields=["status", "updated_at"])

        # Clean up QA draft if exists
        QADraftReview.objects.filter(job=job).delete()

        return Response(
            {"detail": "Annotation rejected.", "status": job.status},
            status=status.HTTP_201_CREATED,
        )

    def my_jobs(self, request):
        base_queryset = (
            Job.objects.filter(assigned_qa=request.user)
            .select_related("dataset", "assigned_annotator")
            .order_by("-updated_at")
        )

        # Compute status counts from unfiltered base queryset
        status_counts_qs = (
            Job.objects.filter(assigned_qa=request.user)
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

        blind_review = self._get_blind_review_setting()
        paginator = QAJobsPagination()
        paginator.status_counts = status_counts
        page = paginator.paginate_queryset(queryset, request)
        serializer = MyQAJobsSerializer(
            page, many=True, context={"blind_review": blind_review}
        )
        return paginator.get_paginated_response(serializer.data)

    def get_qa_draft(self, request, job_id):
        job, err = self._get_job(job_id, request.user)
        if err:
            return err
        try:
            draft = QADraftReview.objects.get(job=job)
            return Response({"data": draft.data})
        except QADraftReview.DoesNotExist:
            return Response({"data": {}})

    def save_qa_draft(self, request, job_id):
        allowed = [Job.Status.QA_IN_PROGRESS]
        job, err = self._get_job(job_id, request.user, allowed)
        if err:
            return err
        serializer = SaveQADraftSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        QADraftReview.objects.update_or_create(
            job=job,
            defaults={"data": serializer.validated_data["data"]},
        )
        return Response({"detail": "QA draft saved."})
