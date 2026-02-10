import hashlib
import io
import os
import zipfile

from django.db import transaction
from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from accounts.models import User
from core.permissions import IsAdmin

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

            jobs = []
            for candidate in candidates:
                if candidate["content_hash"] in existing_hashes:
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
            duplicate_count = total_extracted - len(jobs)

            Job.objects.bulk_create(jobs)
            dataset.status = Dataset.Status.READY
            dataset.file_count = len(jobs)
            dataset.duplicate_count = duplicate_count
            dataset.save(update_fields=["status", "file_count", "duplicate_count"])

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
