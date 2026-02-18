import re

from django.db import transaction
from django.db.models import Q
from django.db.models.functions import Replace
from django.db.models import Value
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.viewsets import ViewSet

from annotations.models import Annotation, DraftAnnotation
from core.permissions import IsAdmin, IsAnyRole
from qa.models import QADraftReview

from .models import AnnotationClass, ExcludedFileHash
from .serializers import (
    AnnotationClassSerializer,
    CreateAnnotationClassSerializer,
    CreateExcludedFileHashSerializer,
    ExcludedFileHashSerializer,
    RenameAnnotationClassSerializer,
    UpdateAnnotationClassSerializer,
)


class AnnotationClassViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_permissions(self):
        if self.action in ("list", "usage"):
            return [IsAuthenticated(), IsAnyRole()]
        return super().get_permissions()

    def list(self, request):
        queryset = AnnotationClass.objects.filter(is_deleted=False).order_by(
            "display_label"
        )
        return Response(AnnotationClassSerializer(queryset, many=True).data)

    def create(self, request):
        serializer = CreateAnnotationClassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        annotation_class = AnnotationClass.objects.create(
            name=data["name"],
            display_label=data["display_label"],
            color=data["color"],
            description=data.get("description", ""),
            created_by=request.user,
        )
        return Response(
            AnnotationClassSerializer(annotation_class).data,
            status=status.HTTP_201_CREATED,
        )

    def partial_update(self, request, pk=None):
        try:
            annotation_class = AnnotationClass.objects.get(pk=pk, is_deleted=False)
        except AnnotationClass.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateAnnotationClassSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        for attr, value in serializer.validated_data.items():
            setattr(annotation_class, attr, value)
        annotation_class.save(update_fields=list(serializer.validated_data.keys()))

        return Response(AnnotationClassSerializer(annotation_class).data)

    def destroy(self, request, pk=None):
        try:
            annotation_class = AnnotationClass.objects.get(pk=pk, is_deleted=False)
        except AnnotationClass.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        annotation_class.is_deleted = True
        annotation_class.save(update_fields=["is_deleted"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"])
    def usage(self, request, pk=None):
        try:
            annotation_class = AnnotationClass.objects.get(pk=pk, is_deleted=False)
        except AnnotationClass.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        count = Annotation.objects.filter(annotation_class=annotation_class).count()
        return Response(
            {
                "annotation_class_id": str(annotation_class.id),
                "annotation_count": count,
            }
        )

    @action(detail=True, methods=["post"])
    def rename(self, request, pk=None):
        try:
            annotation_class = AnnotationClass.objects.get(pk=pk, is_deleted=False)
        except AnnotationClass.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = RenameAnnotationClassSerializer(
            data=request.data, context={"instance_pk": pk}
        )
        serializer.is_valid(raise_exception=True)

        old_name = annotation_class.name
        new_name = serializer.validated_data["name"]

        if old_name == new_name:
            return Response(
                {
                    "annotation_class": AnnotationClassSerializer(annotation_class).data,
                    "updated_annotations": 0,
                }
            )

        with transaction.atomic():
            # 1. Update AnnotationClass name
            annotation_class.name = new_name
            annotation_class.save(update_fields=["name"])

            # 2. Bulk update Annotation.class_name
            annotation_qs = Annotation.objects.filter(annotation_class=annotation_class)
            updated_count = annotation_qs.update(class_name=new_name)

            # 3. Update Annotation.tag using SQL REPLACE
            annotation_qs.update(
                tag=Replace("tag", Value(f"[{old_name}_"), Value(f"[{new_name}_"))
            )

            # 4. Patch DraftAnnotation JSON
            for draft in DraftAnnotation.objects.all():
                annotations = draft.annotations
                modified = False
                for item in annotations:
                    if item.get("class_name") == old_name:
                        item["class_name"] = new_name
                        if "tag" in item:
                            item["tag"] = item["tag"].replace(
                                f"[{old_name}_", f"[{new_name}_"
                            )
                        modified = True
                if modified:
                    draft.annotations = annotations
                    draft.save(update_fields=["annotations"])

            # 5. Patch QADraftReview JSON
            for draft in QADraftReview.objects.all():
                data = draft.data
                qa_annotations = data.get("annotations", [])
                modified = False
                for item in qa_annotations:
                    if item.get("className") == old_name:
                        item["className"] = new_name
                        if "tag" in item:
                            item["tag"] = item["tag"].replace(
                                f"[{old_name}_", f"[{new_name}_"
                            )
                        modified = True
                if modified:
                    draft.data = data
                    draft.save(update_fields=["data"])

        return Response(
            {
                "annotation_class": AnnotationClassSerializer(annotation_class).data,
                "updated_annotations": updated_count,
            }
        )


class ExcludedFileHashViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]

    def list(self, request):
        queryset = ExcludedFileHash.objects.select_related("created_by").all()

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(content_hash__icontains=search)
                | Q(file_name__icontains=search)
                | Q(note__icontains=search)
            )

        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        items = queryset[start:end]

        return Response(
            {
                "count": total,
                "results": ExcludedFileHashSerializer(items, many=True).data,
            }
        )

    def create(self, request):
        serializer = CreateExcludedFileHashSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        obj = ExcludedFileHash.objects.create(
            content_hash=data["content_hash"],
            file_name=data.get("file_name", ""),
            note=data.get("note", ""),
            created_by=request.user,
        )
        return Response(
            ExcludedFileHashSerializer(obj).data,
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, pk=None):
        try:
            obj = ExcludedFileHash.objects.get(pk=pk)
        except ExcludedFileHash.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-create")
    def bulk_create(self, request):
        items = request.data.get("items", [])
        if not items:
            return Response(
                {"detail": "items list is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        created = 0
        skipped = 0
        errors = []
        hex_pattern = re.compile(r"^[0-9a-f]{64}$")

        to_create = []
        seen = set()

        for i, item in enumerate(items):
            content_hash = str(item.get("content_hash", "")).lower().strip()
            if not hex_pattern.match(content_hash):
                errors.append({"index": i, "error": "Invalid SHA-256 hash."})
                continue
            if content_hash in seen:
                skipped += 1
                continue
            seen.add(content_hash)
            to_create.append(
                ExcludedFileHash(
                    content_hash=content_hash,
                    file_name=str(item.get("file_name", "")),
                    note=str(item.get("note", "")),
                    created_by=request.user,
                )
            )

        # Filter out hashes that already exist in DB
        existing = set(
            ExcludedFileHash.objects.filter(
                content_hash__in=[o.content_hash for o in to_create]
            ).values_list("content_hash", flat=True)
        )

        new_objects = [o for o in to_create if o.content_hash not in existing]
        skipped += len(to_create) - len(new_objects)

        ExcludedFileHash.objects.bulk_create(new_objects, ignore_conflicts=True)
        created = len(new_objects)

        return Response(
            {"created": created, "skipped": skipped, "errors": errors},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["delete"], url_path="bulk-delete")
    def bulk_delete(self, request):
        ids = request.data.get("ids", [])
        if not ids:
            return Response(
                {"detail": "ids list is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_count, _ = ExcludedFileHash.objects.filter(id__in=ids).delete()
        return Response({"deleted": deleted_count})
