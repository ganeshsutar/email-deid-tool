import uuid
from django.conf import settings
from django.db import models


class ExportRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dataset = models.ForeignKey("datasets.Dataset", on_delete=models.CASCADE, related_name="exports", null=True, blank=True)
    job_ids = models.JSONField(default=list)
    file_size = models.BigIntegerField(default=0)
    file_path = models.CharField(max_length=500)
    exported_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="exports"
    )
    exported_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        dataset_name = self.dataset.name if self.dataset else "Multiple Datasets"
        return f"Export {self.id} - {dataset_name}"
