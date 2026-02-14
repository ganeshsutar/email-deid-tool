from rest_framework import serializers

from datasets.serializers import MiniUserSerializer


class DatasetWithDeliveredSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()
    delivered_count = serializers.IntegerField()


class DeliveredJobSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    file_name = serializers.CharField()
    assigned_annotator = MiniUserSerializer()
    assigned_qa = MiniUserSerializer()
    annotation_count = serializers.IntegerField()
    delivered_date = serializers.DateTimeField()
    dataset_name = serializers.CharField(required=False, default="")


class ExportRecordSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    dataset_name = serializers.CharField()
    job_count = serializers.IntegerField()
    file_size = serializers.IntegerField()
    exported_by = MiniUserSerializer()
    exported_at = serializers.DateTimeField()
    download_url = serializers.CharField()


class CreateExportSerializer(serializers.Serializer):
    job_ids = serializers.ListField(
        child=serializers.UUIDField(),
        min_length=1,
    )
