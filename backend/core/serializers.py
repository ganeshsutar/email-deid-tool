import re

from rest_framework import serializers

from .models import AnnotationClass, ExcludedFileHash


class MiniUserSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    name = serializers.CharField()


class AnnotationClassSerializer(serializers.ModelSerializer):
    created_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = AnnotationClass
        fields = [
            "id",
            "name",
            "display_label",
            "color",
            "description",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class CreateAnnotationClassSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    display_label = serializers.CharField(max_length=100)
    color = serializers.CharField(max_length=7)
    description = serializers.CharField(required=False, default="", allow_blank=True)

    def validate_name(self, value):
        if not re.match(r"^[a-z][a-z0-9_]*$", value):
            raise serializers.ValidationError(
                "Name must start with a lowercase letter and contain only "
                "lowercase letters, digits, and underscores."
            )
        if AnnotationClass.objects.filter(name=value, is_deleted=False).exists():
            raise serializers.ValidationError(
                "An annotation class with this name already exists."
            )
        return value

    def validate_display_label(self, value):
        if AnnotationClass.objects.filter(display_label=value, is_deleted=False).exists():
            raise serializers.ValidationError(
                "An annotation class with this display label already exists."
            )
        return value

    def validate_color(self, value):
        if not re.match(r"^#[0-9a-fA-F]{6}$", value):
            raise serializers.ValidationError("Color must be in #RRGGBB format.")
        return value


class ExcludedFileHashSerializer(serializers.ModelSerializer):
    created_by = MiniUserSerializer(read_only=True)

    class Meta:
        model = ExcludedFileHash
        fields = [
            "id",
            "content_hash",
            "file_name",
            "note",
            "created_by",
            "created_at",
        ]
        read_only_fields = fields


class CreateExcludedFileHashSerializer(serializers.Serializer):
    content_hash = serializers.CharField(max_length=64)
    file_name = serializers.CharField(max_length=255, required=False, default="", allow_blank=True)
    note = serializers.CharField(required=False, default="", allow_blank=True)

    def validate_content_hash(self, value):
        value = value.lower().strip()
        if not re.match(r"^[0-9a-f]{64}$", value):
            raise serializers.ValidationError(
                "Must be a valid 64-character hex SHA-256 hash."
            )
        if ExcludedFileHash.objects.filter(content_hash=value).exists():
            raise serializers.ValidationError("This hash is already in the blocklist.")
        return value

class RenameAnnotationClassSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)

    def validate_name(self, value):
        if not re.match(r"^[a-z][a-z0-9_]*$", value):
            raise serializers.ValidationError(
                "Name must start with a lowercase letter and contain only "
                "lowercase letters, digits, and underscores."
            )
        instance_pk = self.context.get("instance_pk")
        qs = AnnotationClass.objects.filter(name=value, is_deleted=False)
        if instance_pk:
            qs = qs.exclude(pk=instance_pk)
        if qs.exists():
            raise serializers.ValidationError(
                "An annotation class with this name already exists."
            )
        return value


class UpdateAnnotationClassSerializer(serializers.Serializer):
    display_label = serializers.CharField(max_length=100, required=False)
    color = serializers.CharField(max_length=7, required=False)
    description = serializers.CharField(required=False, allow_blank=True)

    def validate_color(self, value):
        if not re.match(r"^#[0-9a-fA-F]{6}$", value):
            raise serializers.ValidationError("Color must be in #RRGGBB format.")
        return value
