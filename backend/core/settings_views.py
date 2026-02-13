import json

from rest_framework import status as http_status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsAdmin

from .models import PlatformSetting


DEFAULT_DISCARD_REASONS = [
    "Not an email",
    "Corrupted file",
    "Duplicate content",
    "Irrelevant content",
    "Incomplete/truncated",
    "Other",
]


def get_discard_reasons():
    """Return list of configured discard reasons."""
    try:
        setting = PlatformSetting.objects.get(key="discard_reasons")
        reasons = json.loads(setting.value)
        if isinstance(reasons, list) and len(reasons) > 0:
            return reasons
    except (PlatformSetting.DoesNotExist, json.JSONDecodeError):
        pass
    return DEFAULT_DISCARD_REASONS


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated, IsAdmin])
def blind_review_setting(request):
    if request.method == "GET":
        try:
            setting = PlatformSetting.objects.get(key="blind_review")
            enabled = setting.value.lower() in ("true", "1", "yes")
        except PlatformSetting.DoesNotExist:
            enabled = False
        return Response({"enabled": enabled})

    # PUT
    enabled = request.data.get("enabled", False)
    PlatformSetting.objects.update_or_create(
        key="blind_review",
        defaults={"value": str(enabled).lower()},
    )
    return Response({"enabled": bool(enabled)})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated, IsAdmin])
def min_annotation_length_setting(request):
    if request.method == "GET":
        try:
            setting = PlatformSetting.objects.get(key="min_annotation_length")
            min_length = max(1, int(setting.value))
        except (PlatformSetting.DoesNotExist, ValueError):
            min_length = 1
        return Response({"min_length": min_length})

    # PUT
    try:
        min_length = max(1, int(request.data.get("min_length", 1)))
    except (TypeError, ValueError):
        min_length = 1
    PlatformSetting.objects.update_or_create(
        key="min_annotation_length",
        defaults={"value": str(min_length)},
    )
    return Response({"min_length": min_length})


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def discard_reasons_setting(request):
    if request.method == "GET":
        return Response({"reasons": get_discard_reasons()})

    # PUT — admin only
    if not IsAdmin().has_permission(request, None):
        return Response(
            {"detail": "You do not have permission to perform this action."},
            status=http_status.HTTP_403_FORBIDDEN,
        )
    reasons = request.data.get("reasons")
    if not isinstance(reasons, list) or len(reasons) == 0:
        return Response(
            {"detail": "reasons must be a non-empty list of strings."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    # Validate all items are non-empty strings
    cleaned = [r.strip() for r in reasons if isinstance(r, str) and r.strip()]
    if len(cleaned) == 0:
        return Response(
            {"detail": "reasons must contain at least one non-empty string."},
            status=http_status.HTTP_400_BAD_REQUEST,
        )
    PlatformSetting.objects.update_or_create(
        key="discard_reasons",
        defaults={"value": json.dumps(cleaned)},
    )
    return Response({"reasons": cleaned})
