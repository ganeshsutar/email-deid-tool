from django.urls import path

from .views import ExportViewSet

urlpatterns = [
    path(
        "datasets/",
        ExportViewSet.as_view({"get": "list_datasets"}),
    ),
    path(
        "jobs/",
        ExportViewSet.as_view({"get": "list_all_delivered_jobs"}),
    ),
    path(
        "datasets/<uuid:dataset_id>/jobs/",
        ExportViewSet.as_view({"get": "list_delivered_jobs"}),
    ),
    path(
        "preview/<uuid:job_id>/",
        ExportViewSet.as_view({"get": "preview"}),
    ),
    path(
        "",
        ExportViewSet.as_view({"get": "list_exports", "post": "create_export"}),
    ),
    path(
        "<uuid:export_id>/download/",
        ExportViewSet.as_view({"get": "download"}),
    ),
]
