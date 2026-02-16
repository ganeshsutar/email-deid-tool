import csv
from datetime import datetime

from django.db.models import Count, Q
from django.http import HttpResponse
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

    @staticmethod
    def _parse_date_range(request):
        """Parse optional date_from / date_to query params (YYYY-MM-DD).

        Returns date objects (not datetimes) for use with Django's __date
        lookup, which correctly handles timezone conversion in the database.
        """
        date_from = None
        date_to = None
        raw_from = request.query_params.get("date_from")
        raw_to = request.query_params.get("date_to")
        try:
            if raw_from:
                date_from = datetime.strptime(raw_from, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass
        try:
            if raw_to:
                date_to = datetime.strptime(raw_to, "%Y-%m-%d").date()
        except (ValueError, TypeError):
            pass
        return date_from, date_to

    def stats(self, request):
        ann_completed_statuses = [
            Job.Status.SUBMITTED_FOR_QA,
            Job.Status.ASSIGNED_QA,
            Job.Status.QA_IN_PROGRESS,
            Job.Status.QA_ACCEPTED,
            Job.Status.QA_REJECTED,
            Job.Status.DELIVERED,
        ]
        qa_completed_statuses = [
            Job.Status.QA_ACCEPTED,
            Job.Status.QA_REJECTED,
            Job.Status.DELIVERED,
        ]
        return Response(
            {
                "total_datasets": Dataset.objects.count(),
                "total_jobs": Job.objects.count(),
                "ann_assigned": Job.objects.filter(
                    assigned_annotator__isnull=False
                ).count(),
                "ann_in_progress": Job.objects.filter(
                    status=Job.Status.ANNOTATION_IN_PROGRESS
                ).count(),
                "ann_completed": Job.objects.filter(
                    assigned_annotator__isnull=False,
                    status__in=ann_completed_statuses,
                ).count(),
                "qa_assigned": Job.objects.filter(
                    assigned_qa__isnull=False
                ).count(),
                "qa_in_progress": Job.objects.filter(
                    status=Job.Status.QA_IN_PROGRESS
                ).count(),
                "qa_completed": Job.objects.filter(
                    assigned_qa__isnull=False,
                    status__in=qa_completed_statuses,
                ).count(),
                "delivered": Job.objects.filter(
                    status=Job.Status.DELIVERED
                ).count(),
                "discarded": Job.objects.filter(
                    status=Job.Status.DISCARDED
                ).count(),
            }
        )

    def _filter_jobs_by_datasets(self, request):
        """Return a Job queryset filtered by dataset_ids or dataset_id param."""
        qs = Job.objects.all()
        dataset_ids = request.query_params.get("dataset_ids")
        if dataset_ids:
            id_list = [v.strip() for v in dataset_ids.split(",") if v.strip()]
            if id_list:
                qs = qs.filter(dataset_id__in=id_list)
        else:
            dataset_id = request.query_params.get("dataset_id")
            if dataset_id:
                qs = qs.filter(dataset_id=dataset_id)
        return qs

    def job_status_counts(self, request):
        qs = self._filter_jobs_by_datasets(request)
        counts = qs.values("status").annotate(count=Count("id")).order_by("status")
        result = {item["status"]: item["count"] for item in counts}
        return Response(result)

    def job_csv_export(self, request):
        status = request.query_params.get("status")
        if not status:
            return Response({"detail": "status query param is required."}, status=400)
        valid_statuses = {c[0] for c in Job.Status.choices}
        if status not in valid_statuses:
            return Response({"detail": f"Invalid status: {status}"}, status=400)

        qs = self._filter_jobs_by_datasets(request).filter(status=status)
        qs = qs.select_related(
            "dataset", "assigned_annotator", "assigned_qa", "discarded_by"
        ).order_by("created_at")

        response = HttpResponse(content_type="text/csv")
        response["Content-Disposition"] = (
            f'attachment; filename="jobs_{status.lower()}.csv"'
        )

        writer = csv.writer(response)
        writer.writerow([
            "File Name",
            "Dataset",
            "Status",
            "Assigned Annotator",
            "Assigned QA",
            "Discard Reason",
            "Discarded By",
            "Created At",
            "Updated At",
        ])
        for job in qs.iterator():
            writer.writerow([
                job.file_name,
                job.dataset.name if job.dataset else "",
                job.get_status_display(),
                job.assigned_annotator.name if job.assigned_annotator else "",
                job.assigned_qa.name if job.assigned_qa else "",
                job.discard_reason,
                job.discarded_by.name if job.discarded_by else "",
                job.created_at.isoformat(),
                job.updated_at.isoformat(),
            ])
        return response

    def recent_datasets(self, request):
        datasets = Dataset.objects.prefetch_related("jobs").select_related(
            "uploaded_by"
        ).order_by("-upload_date")[:5]
        return Response(DatasetListSerializer(datasets, many=True).data)

    def annotator_performance(self, request):
        date_from, date_to = self._parse_date_range(request)

        # For completed/delivered/rejected: filter by when annotator actually submitted
        submitted_date_q = Q()
        if date_from:
            submitted_date_q &= Q(
                annotator_jobs__annotation_versions__created_at__date__gte=date_from,
                annotator_jobs__annotation_versions__source="ANNOTATOR",
            )
        if date_to:
            submitted_date_q &= Q(
                annotator_jobs__annotation_versions__created_at__date__lte=date_to,
                annotator_jobs__annotation_versions__source="ANNOTATOR",
            )

        # For assigned/in_progress: filter by last activity on the job
        activity_date_q = Q()
        if date_from:
            activity_date_q &= Q(annotator_jobs__updated_at__date__gte=date_from)
        if date_to:
            activity_date_q &= Q(annotator_jobs__updated_at__date__lte=date_to)

        completed_statuses = [
            Job.Status.SUBMITTED_FOR_QA,
            Job.Status.ASSIGNED_QA,
            Job.Status.QA_IN_PROGRESS,
            Job.Status.QA_ACCEPTED,
            Job.Status.DELIVERED,
        ]
        in_progress_statuses = [
            Job.Status.ANNOTATION_IN_PROGRESS,
        ]

        annotators = User.objects.filter(
            role=User.Role.ANNOTATOR, status=User.Status.ACTIVE
        ).annotate(
            assigned_jobs=Count(
                "annotator_jobs",
                filter=activity_date_q or None,
                distinct=True,
            ),
            completed_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status__in=completed_statuses)
                & submitted_date_q,
                distinct=True,
            ),
            in_progress_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status__in=in_progress_statuses),
                distinct=True,
            ),
            delivered_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status=Job.Status.DELIVERED)
                & submitted_date_q,
                distinct=True,
            ),
            rejected_jobs=Count(
                "annotator_jobs",
                filter=Q(annotator_jobs__status=Job.Status.QA_REJECTED)
                & submitted_date_q,
                distinct=True,
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
        date_from, date_to = self._parse_date_range(request)
        job_date_q = Q()
        if date_from:
            job_date_q &= Q(qa_jobs__updated_at__date__gte=date_from)
        if date_to:
            job_date_q &= Q(qa_jobs__updated_at__date__lte=date_to)

        review_date_q = Q()
        if date_from:
            review_date_q &= Q(qa_reviews__reviewed_at__date__gte=date_from)
        if date_to:
            review_date_q &= Q(qa_reviews__reviewed_at__date__lte=date_to)

        completed_statuses = [
            Job.Status.QA_ACCEPTED,
            Job.Status.QA_REJECTED,
            Job.Status.DELIVERED,
        ]

        qa_users = User.objects.filter(
            role=User.Role.QA, status=User.Status.ACTIVE
        ).annotate(
            reviewed_jobs=Count(
                "qa_reviews", filter=review_date_q or None, distinct=True
            ),
            accepted_jobs=Count(
                "qa_reviews",
                filter=Q(qa_reviews__decision=QAReviewVersion.Decision.ACCEPT)
                & review_date_q,
                distinct=True,
            ),
            rejected_jobs=Count(
                "qa_reviews",
                filter=Q(qa_reviews__decision=QAReviewVersion.Decision.REJECT)
                & review_date_q,
                distinct=True,
            ),
            in_review_jobs=Count(
                "qa_jobs",
                filter=Q(qa_jobs__status=Job.Status.QA_IN_PROGRESS),
                distinct=True,
            ),
            assigned_jobs=Count(
                "qa_jobs", filter=job_date_q or None, distinct=True
            ),
            completed_jobs=Count(
                "qa_jobs",
                filter=Q(qa_jobs__status__in=completed_statuses) & job_date_q,
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
