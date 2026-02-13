from rest_framework import serializers

from datasets.serializers import MiniUserSerializer
from .models import Annotation, AnnotationVersion, DraftAnnotation


class AnnotationSerializer(serializers.ModelSerializer):
    class_color = serializers.SerializerMethodField()
    class_display_label = serializers.SerializerMethodField()

    class Meta:
        model = Annotation
        fields = [
            "id",
            "annotation_class",
            "class_name",
            "tag",
            "section_index",
            "start_offset",
            "end_offset",
            "original_text",
            "created_at",
            "class_color",
            "class_display_label",
        ]
        read_only_fields = fields

    def get_class_color(self, obj):
        if obj.annotation_class:
            return obj.annotation_class.color
        return "#888888"

    def get_class_display_label(self, obj):
        if obj.annotation_class:
            return obj.annotation_class.display_label
        return obj.class_name


class AnnotationVersionSerializer(serializers.ModelSerializer):
    annotations = AnnotationSerializer(many=True, read_only=True)
    created_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = AnnotationVersion
        fields = [
            "id",
            "version_number",
            "created_by",
            "source",
            "created_at",
            "annotations",
        ]
        read_only_fields = fields


class JobForAnnotationSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    dataset = serializers.UUIDField(source="dataset_id")
    dataset_name = serializers.CharField(source="dataset.name")
    file_name = serializers.CharField()
    status = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    raw_content_url = serializers.SerializerMethodField()
    latest_annotations = serializers.SerializerMethodField()
    rework_info = serializers.SerializerMethodField()
    min_annotation_length = serializers.SerializerMethodField()

    def get_min_annotation_length(self, obj):
        return self.context.get("min_annotation_length", 1)

    def get_raw_content_url(self, obj):
        return f"/api/annotations/jobs/{obj.id}/raw-content/"

    def get_latest_annotations(self, obj):
        latest_version = (
            obj.annotation_versions.order_by("-version_number").first()
        )
        if latest_version:
            return AnnotationSerializer(
                latest_version.annotations.select_related("annotation_class").all(),
                many=True,
            ).data
        return []

    def get_rework_info(self, obj):
        if obj.status not in ("QA_REJECTED", "ANNOTATION_IN_PROGRESS"):
            return None
        latest_review = (
            obj.qa_reviews.order_by("-version_number").first()
        )
        if not latest_review or latest_review.decision != "REJECT":
            return None
        return {
            "comments": latest_review.comments,
            "reviewer_name": latest_review.reviewed_by.name if latest_review.reviewed_by else None,
            "reviewer_id": str(latest_review.reviewed_by.id) if latest_review.reviewed_by else None,
            "reviewed_at": latest_review.reviewed_at.isoformat(),
        }


class SaveDraftSerializer(serializers.Serializer):
    annotations = serializers.JSONField()

    def validate_annotations(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError("Must be a list.")
        return value


class SubmitAnnotationSerializer(serializers.Serializer):
    annotations = serializers.ListField(
        child=serializers.DictField(),
        allow_empty=True,
    )

    def validate_annotations(self, value):
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


class MyAnnotationJobsSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    dataset = serializers.UUIDField(source="dataset_id")
    dataset_name = serializers.CharField(source="dataset.name")
    file_name = serializers.CharField()
    status = serializers.CharField()
    discard_reason = serializers.CharField()
    created_at = serializers.DateTimeField()
    updated_at = serializers.DateTimeField()
    annotation_count = serializers.SerializerMethodField()
    rework_info = serializers.SerializerMethodField()

    def get_annotation_count(self, obj):
        latest_version = (
            obj.annotation_versions.order_by("-version_number").first()
        )
        if latest_version:
            return latest_version.annotations.count()
        return 0

    def get_rework_info(self, obj):
        if obj.status not in ("QA_REJECTED", "ANNOTATION_IN_PROGRESS"):
            return None
        latest_review = (
            obj.qa_reviews.order_by("-version_number").first()
        )
        if not latest_review or latest_review.decision != "REJECT":
            return None
        return {
            "comments": latest_review.comments,
            "reviewer_name": latest_review.reviewed_by.name if latest_review.reviewed_by else None,
            "reviewer_id": str(latest_review.reviewed_by.id) if latest_review.reviewed_by else None,
            "reviewed_at": latest_review.reviewed_at.isoformat(),
        }
