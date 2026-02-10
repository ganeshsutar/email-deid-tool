from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.permissions import IsAdmin

from .models import PlatformSetting


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
