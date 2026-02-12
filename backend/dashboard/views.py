from django.db.models import Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from accounts.models import User
from core.permissions import IsAdmin
from datasets.models import Dataset, Job
from datasets.serializers import DatasetListSerializer
from qa.models import QAReviewVersion


class DashboardViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]

    def stats(self, request):
        in_progress_statuses = [
            Job.Status.ASSIGNED_ANNOTATOR,
            Job.Status.ANNOTATION_IN_PROGRESS,
            Job.Status.ASSIGNED_QA,
            Job.Status.QA_IN_PROGRESS,
        ]
        return Response(
            {
                "total_datasets": Dataset.objects.count(),
                "total_jobs": Job.objects.count(),
                "pending_assignment": Job.objects.filter(
                    status=Job.Status.UPLOADED
                ).count(),
                "in_progress": Job.objects.filter(
                    status__in=in_progress_statuses
                ).count(),
                "delivered": Job.objects.filter(
                    status=Job.Status.DELIVERED
                ).count(),
                "awaiting_qa": Job.objects.filter(
                    status=Job.Status.SUBMITTED_FOR_QA
                ).count(),
            }
        )

    def job_status_counts(self, request):
        dataset_id = request.query_params.get("dataset_id")
        qs = Job.objects.all()
        if dataset_id:
            qs = qs.filter(dataset_id=dataset_id)
        counts = qs.values("status").annotate(count=Count("id")).order_by("status")
        result = {item["status"]: item["count"] for item in counts}
        return Response(result)

    def recent_datasets(self, request):
        datasets = Dataset.objects.prefetch_related("jobs").select_related(
            "uploaded_by"
        ).order_by("-upload_date")[:5]
        return Response(DatasetListSerializer(datasets, many=True).data)

    def annotator_performance(self, request):
        completed_statuses = [
            Job.Status.SUBMITTED_FOR_QA,
            Job.Status.ASSIGNED_QA,
            Job.Status.QA_IN_PROGRESS,
            Job.Status.QA_ACCEPTED,
            Job.Status.DELIVERED,
        ]
        in_progress_statuses = [
            Job.Status.ASSIGNED_ANNOTATOR,
            Job.Status.ANNOTATION_IN_PROGRESS,
        ]

        annotators = User.objects.filter(
            role=User.Role.ANNOTATOR, status=User.Status.ACTIVE
        ).annotate(
            assigned_jobs=Count("annotator_jobs"),
            completed_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status__in=completed_statuses),
            ),
            in_progress_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status__in=in_progress_statuses),
            ),
            delivered_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status=Job.Status.DELIVERED),
            ),
            rejected_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status=Job.Status.QA_REJECTED),
            ),
        )

        result = []
        for user in annotators:
            total_decided = user.delivered_jobs + user.rejected_jobs
            acceptance_rate = (
                round((user.delivered_jobs / total_decided) * 100, 1)
                if total_decided > 0
                else None
            )
            result.append(
                {
                    "id": str(user.id),
                    "name": user.name,
                    "assigned_jobs": user.assigned_jobs,
                    "completed_jobs": user.completed_jobs,
                    "in_progress_jobs": user.in_progress_jobs,
                    "acceptance_rate": acceptance_rate,
                    "avg_annotations_per_job": None,
                }
            )
        return Response(result)

    def qa_performance(self, request):
        completed_statuses = [
            Job.Status.QA_ACCEPTED,
            Job.Status.QA_REJECTED,
            Job.Status.DELIVERED,
        ]

        qa_users = User.objects.filter(
            role=User.Role.QA, status=User.Status.ACTIVE
        ).annotate(
            reviewed_jobs=Count("qa_reviews", distinct=True),
            accepted_jobs=Count(
                "qa_reviews",
                filter=Q(qa_reviews__decision=QAReviewVersion.Decision.ACCEPT),
                distinct=True,
            ),
            rejected_jobs=Count(
                "qa_reviews",
                filter=Q(qa_reviews__decision=QAReviewVersion.Decision.REJECT),
                distinct=True,
            ),
            in_review_jobs=Count(
                "qa_jobs",
                filter=Q(qa_jobs__status=Job.Status.QA_IN_PROGRESS),
                distinct=True,
            ),
            assigned_jobs=Count("qa_jobs", distinct=True),
            completed_jobs=Count(
                "qa_jobs",
                filter=Q(qa_jobs__status__in=completed_statuses),
                distinct=True,
            ),
        )

        result = []
        for user in qa_users:
            total_decided = user.accepted_jobs + user.rejected_jobs
            acceptance_rate = (
                round((user.accepted_jobs / total_decided) * 100, 1)
                if total_decided > 0
                else None
            )
            result.append(
                {
                    "id": str(user.id),
                    "name": user.name,
                    "reviewed_jobs": user.reviewed_jobs,
                    "accepted_jobs": user.accepted_jobs,
                    "rejected_jobs": user.rejected_jobs,
                    "in_review_jobs": user.in_review_jobs,
                    "avg_review_time": None,
                    "assigned_jobs": user.assigned_jobs,
                    "completed_jobs": user.completed_jobs,
                    "acceptance_rate": acceptance_rate,
                }
            )
        return Response(result)
