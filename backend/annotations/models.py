import uuid
from django.conf import settings
from django.db import models


class AnnotationVersion(models.Model):
    class Source(models.TextChoices):
        ANNOTATOR = "ANNOTATOR", "Annotator"
        QA = "QA", "QA"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey("datasets.Job", on_delete=models.CASCADE, related_name="annotation_versions")
    version_number = models.PositiveIntegerField()
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="annotation_versions"
    )
    source = models.CharField(max_length=20, choices=Source.choices)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [["job", "version_number"]]

    def __str__(self):
        return f"Job {self.job_id} v{self.version_number}"


class Annotation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    annotation_version = models.ForeignKey(
        AnnotationVersion, on_delete=models.CASCADE, related_name="annotations"
    )
    annotation_class = models.ForeignKey(
        "core.AnnotationClass", on_delete=models.SET_NULL, null=True, related_name="annotations"
    )
    class_name = models.CharField(max_length=100)
    tag = models.CharField(max_length=100, blank=True, default="")
    section_index = models.IntegerField(default=0)
    start_offset = models.IntegerField()
    end_offset = models.IntegerField()
    original_text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.class_name}: {self.original_text[:50]}"


class DraftAnnotation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.OneToOneField("datasets.Job", on_delete=models.CASCADE, related_name="draft_annotation")
    annotations = models.JSONField(default=list)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Draft for Job {self.job_id}"
