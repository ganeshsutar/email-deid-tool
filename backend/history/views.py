from django.db.models import Count
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from annotations.models import AnnotationVersion
from annotations.serializers import AnnotationSerializer
from core.permissions import IsAnyRole
from datasets.models import Job
from qa.models import QAReviewVersion

from .serializers import (
    VersionHistoryAnnotationVersionSerializer,
    VersionHistoryJobInfoSerializer,
    VersionHistoryQAReviewSerializer,
)


class HistoryViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAnyRole]

    def _check_job_access(self, job, user):
        """Check if the user can access this job's history."""
        if user.role == "ADMIN":
            return True
        if user.role == "ANNOTATOR" and job.assigned_annotator_id == user.id:
            return True
        if user.role == "QA":
            if job.assigned_qa_id == user.id:
                return True
            if job.qa_reviews.filter(reviewed_by=user).exists():
                return True
        return False

    def get_version_history(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id)
        except Job.DoesNotExist:
            return Response(
                {"detail": "Job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._check_job_access(job, request.user):
            return Response(
                {"detail": "You do not have access to this job's history."},
                status=status.HTTP_403_FORBIDDEN,
            )

        annotation_versions = (
            AnnotationVersion.objects.filter(job=job)
            .select_related("created_by")
            .annotate(annotation_count=Count("annotations"))
            .order_by("version_number")
        )

        qa_reviews = (
            QAReviewVersion.objects.filter(job=job)
            .select_related("reviewed_by")
            .order_by("version_number")
        )

        return Response(
            {
                "annotation_versions": VersionHistoryAnnotationVersionSerializer(
                    annotation_versions, many=True
                ).data,
                "qa_review_versions": VersionHistoryQAReviewSerializer(
                    qa_reviews, many=True
                ).data,
            }
        )

    def get_annotations_for_version(self, request, version_id):
        try:
            version = AnnotationVersion.objects.select_related("job").get(
                id=version_id
            )
        except AnnotationVersion.DoesNotExist:
            return Response(
                {"detail": "Annotation version not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._check_job_access(version.job, request.user):
            return Response(
                {"detail": "You do not have access to this version."},
                status=status.HTTP_403_FORBIDDEN,
            )

        annotations = version.annotations.select_related(
            "annotation_class"
        ).order_by("section_index", "start_offset")

        return Response(AnnotationSerializer(annotations, many=True).data)

    def get_job_info(self, request, job_id):
        try:
            job = Job.objects.select_related("dataset").get(id=job_id)
        except Job.DoesNotExist:
            return Response(
                {"detail": "Job not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._check_job_access(job, request.user):
            return Response(
                {"detail": "You do not have access to this job."},
                status=status.HTTP_403_FORBIDDEN,
            )

        data = {
            "id": job.id,
            "file_name": job.file_name,
            "dataset_name": job.dataset.name,
            "status": job.status,
            "created_at": job.created_at,
        }
        serializer = VersionHistoryJobInfoSerializer(data)
        return Response(serializer.data)
