from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from accounts.views import UserViewSet
from config.spa_view import SPAView
from core.views import AnnotationClassViewSet, ExcludedFileHashViewSet
from datasets.views import DatasetViewSet, JobViewSet

router = DefaultRouter()
router.register(r"users", UserViewSet, basename="users")
router.register(r"annotation-classes", AnnotationClassViewSet, basename="annotation-classes")
router.register(r"datasets", DatasetViewSet, basename="datasets")
router.register(r"jobs", JobViewSet, basename="jobs")
router.register(r"excluded-hashes", ExcludedFileHashViewSet, basename="excluded-hashes")


def health_check(request):
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/health/", health_check, name="health-check"),
    path("api/auth/", include("accounts.urls")),
    path("api/annotations/", include("annotations.urls")),
    path("api/qa/", include("qa.urls")),
    path("api/history/", include("history.urls")),
    path("api/exports/", include("exports.urls")),
    path("api/dashboard/", include("dashboard.urls")),
    path("api/settings/", include("core.settings_urls")),
    path("api/", include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# SPA catch-all — must be last
urlpatterns += [
    re_path(r"^(?!api/|django-admin/|static/|media/).*$", SPAView.as_view()),
]
