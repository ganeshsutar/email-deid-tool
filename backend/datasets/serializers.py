from django.db.models import Count
from rest_framework import serializers

from .models import Dataset, Job


class MiniUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class DatasetListSerializer(serializers.ModelSerializer):
    uploaded_by = MiniUserSerializer(read_only=True)
    status_summary = serializers.SerializerMethodField()

    class Meta:
        model = Dataset
        fields = [
            "id",
            "name",
            "uploaded_by",
            "upload_date",
            "file_count",
            "duplicate_count",
            "status",
            "error_message",
            "status_summary",
        ]
        read_only_fields = fields

    def get_status_summary(self, obj):
        counts = (
            obj.jobs.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        return {item["status"]: item["count"] for item in counts}


class DatasetDetailSerializer(serializers.ModelSerializer):
    uploaded_by = MiniUserSerializer(read_only=True)
    status_summary = serializers.SerializerMethodField()

    class Meta:
        model = Dataset
        fields = [
            "id",
            "name",
            "uploaded_by",
            "upload_date",
            "file_count",
            "duplicate_count",
            "status",
            "error_message",
            "status_summary",
        ]
        read_only_fields = fields

    def get_status_summary(self, obj):
        counts = (
            obj.jobs.values("status")
            .annotate(count=Count("id"))
            .order_by("status")
        )
        return {item["status"]: item["count"] for item in counts}


class DatasetUploadSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    file = serializers.FileField()

    def validate_name(self, value):
        if Dataset.objects.filter(name=value).exists():
            raise serializers.ValidationError(
                "A dataset with this name already exists."
            )
        return value

    def validate_file(self, value):
        if not value.name.endswith(".zip"):
            raise serializers.ValidationError("Only .zip files are accepted.")
        return value


class DatasetStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dataset
        fields = ["id", "status", "file_count", "duplicate_count", "error_message"]
        read_only_fields = fields


class JobSerializer(serializers.ModelSerializer):
    assigned_annotator = MiniUserSerializer(read_only=True)
    assigned_qa = MiniUserSerializer(read_only=True)

    class Meta:
        model = Job
        fields = [
            "id",
            "file_name",
            "status",
            "assigned_annotator",
            "assigned_qa",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class JobDetailSerializer(serializers.ModelSerializer):
    assigned_annotator = MiniUserSerializer(read_only=True)
    assigned_qa = MiniUserSerializer(read_only=True)
    dataset_name = serializers.CharField(source="dataset.name", read_only=True)

    class Meta:
        model = Job
        fields = [
            "id",
            "dataset",
            "dataset_name",
            "file_name",
            "status",
            "assigned_annotator",
            "assigned_qa",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields
