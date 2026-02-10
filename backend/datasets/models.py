import uuid
import zlib

from django.conf import settings
from django.db import models


class Dataset(models.Model):
    class Status(models.TextChoices):
        UPLOADING = "UPLOADING", "Uploading"
        EXTRACTING = "EXTRACTING", "Extracting"
        READY = "READY", "Ready"
        FAILED = "FAILED", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255, unique=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="uploaded_datasets"
    )
    upload_date = models.DateTimeField(auto_now_add=True)
    file_count = models.IntegerField(default=0)
    duplicate_count = models.IntegerField(default=0)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UPLOADING)
    error_message = models.TextField(blank=True, default="")

    def __str__(self):
        return self.name


class Job(models.Model):
    class Status(models.TextChoices):
        UPLOADED = "UPLOADED", "Uploaded"
        ASSIGNED_ANNOTATOR = "ASSIGNED_ANNOTATOR", "Assigned to Annotator"
        ANNOTATION_IN_PROGRESS = "ANNOTATION_IN_PROGRESS", "Annotation in Progress"
        SUBMITTED_FOR_QA = "SUBMITTED_FOR_QA", "Submitted for QA"
        ASSIGNED_QA = "ASSIGNED_QA", "Assigned to QA"
        QA_IN_PROGRESS = "QA_IN_PROGRESS", "QA in Progress"
        QA_REJECTED = "QA_REJECTED", "QA Rejected"
        QA_ACCEPTED = "QA_ACCEPTED", "QA Accepted"
        DELIVERED = "DELIVERED", "Delivered"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.ForeignKey(Dataset, on_delete=models.CASCADE, related_name="jobs")
    file_name = models.CharField(max_length=255)
    eml_content_compressed = models.BinaryField(blank=True, default=b"")
    content_hash = models.CharField(max_length=64, db_index=True, blank=True, default="")
    status = models.CharField(max_length=30, choices=Status.choices, default=Status.UPLOADED)
    assigned_annotator = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="annotator_jobs"
    )
    assigned_qa = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="qa_jobs"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def eml_content(self):
        if not self.eml_content_compressed:
            return ""
        return zlib.decompress(self.eml_content_compressed).decode("utf-8")

    @eml_content.setter
    def eml_content(self, value):
        if value:
            self.eml_content_compressed = zlib.compress(value.encode("utf-8"))
        else:
            self.eml_content_compressed = b""

    def __str__(self):
        return f"{self.file_name} ({self.dataset.name})"
