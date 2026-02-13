from rest_framework import serializers

from annotations.serializers import AnnotationSerializer
from datasets.serializers import MiniUserSerializer
from .models import QAReviewVersion


class QAReviewVersionSerializer(serializers.ModelSerializer):
    reviewed_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = QAReviewVersion
        fields = [
            "id",
            "version_number",
            "annotation_version",
            "reviewed_by",
            "decision",
            "comments",
            "modifications_summary",
            "reviewed_at",
        ]
        read_only_fields = fields


class JobForQASerializer(serializers.Serializer):
    id = serializers.UUIDField()
    dataset = serializers.UUIDField(source="dataset_id")
    dataset_name = serializers.CharField(source="dataset.name")
    file_name = serializers.CharField()
    status = serializers.CharField()
    assigned_qa = MiniUserSerializer(read_only=True)
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    raw_content_url = serializers.SerializerMethodField()
    annotator_info = serializers.SerializerMethodField()
    annotations = serializers.SerializerMethodField()
    annotation_version_id = serializers.SerializerMethodField()

    def get_raw_content_url(self, obj):
        return f"/api/qa/jobs/{obj.id}/raw-content/"

    def get_annotator_info(self, obj):
        blind_review = self.context.get("blind_review", False)
        if blind_review:
            return None
        annotator = obj.assigned_annotator
        if annotator:
            return {"id": str(annotator.id), "name": annotator.name}
        return None

    def get_annotations(self, obj):
        latest_version = (
            obj.annotation_versions.order_by("-version_number").first()
        )
        if latest_version:
            return AnnotationSerializer(
                latest_version.annotations.select_related("annotation_class").all(),
                many=True,
            ).data
        return []

    def get_annotation_version_id(self, obj):
        latest_version = (
            obj.annotation_versions.order_by("-version_number").first()
        )
        if latest_version:
            return str(latest_version.id)
        return None


class AcceptAnnotationSerializer(serializers.Serializer):
    comments = serializers.CharField(required=False, allow_blank=True, default="")
    modifications = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=list,
    )
    modified_annotations = serializers.ListField(
        child=serializers.DictField(),
        required=False,
        default=None,
        allow_null=True,
    )

    def validate_modified_annotations(self, value):
        if value is None:
            return value
        min_length = self.context.get("min_annotation_length", 1)
        for i, ann in enumerate(value):
            required_fields = [
                "annotation_class",
                "tag",
                "section_index",
                "start_offset",
                "end_offset",
                "original_text",
            ]
            for field in required_fields:
                if field not in ann:
                    raise serializers.ValidationError(
                        f"Annotation {i}: missing field '{field}'."
                    )
            if ann["start_offset"] >= ann["end_offset"]:
                raise serializers.ValidationError(
                    f"Annotation {i}: start_offset must be less than end_offset."
                )
            stripped = ann["original_text"].strip()
            if not stripped:
                raise serializers.ValidationError(
                    f"Annotation {i}: original_text cannot be empty or blank."
                )
            if len(stripped) < min_length:
                raise serializers.ValidationError(
                    f"Annotation {i}: original_text must be at least {min_length} characters (got {len(stripped)})."
                )
        return value


class RejectAnnotationSerializer(serializers.Serializer):
    comments = serializers.CharField(min_length=10)
    annotation_notes = serializers.JSONField(required=False, default=dict)


class SaveQADraftSerializer(serializers.Serializer):
    data = serializers.JSONField()


class MyQAJobsSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    dataset = serializers.UUIDField(source="dataset_id")
    dataset_name = serializers.CharField(source="dataset.name")
    file_name = serializers.CharField()
    status = serializers.CharField()
    discard_reason = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    annotator_name = serializers.SerializerMethodField()
    annotation_count = serializers.SerializerMethodField()

    def get_annotator_name(self, obj):
        blind_review = self.context.get("blind_review", False)
        if blind_review:
            return "[Hidden]"
        annotator = obj.assigned_annotator
        return annotator.name if annotator else None

    def get_annotation_count(self, obj):
        latest_version = (
            obj.annotation_versions.order_by("-version_number").first()
        )
        if latest_version:
            return latest_version.annotations.count()
        return 0
