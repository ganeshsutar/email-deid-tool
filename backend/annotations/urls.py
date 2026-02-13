from django.urls import path

from .views import AnnotationViewSet

urlpatterns = [
    path(
        "jobs/<uuid:job_id>/",
        AnnotationViewSet.as_view({"get": "get_job"}),
    ),
    path(
        "jobs/<uuid:job_id>/raw-content/",
        AnnotationViewSet.as_view({"get": "get_raw_content"}),
    ),
    path(
        "jobs/<uuid:job_id>/draft/",
        AnnotationViewSet.as_view({"get": "get_draft", "put": "save_draft"}),
    ),
    path(
        "jobs/<uuid:job_id>/start/",
        AnnotationViewSet.as_view({"post": "start_annotation"}),
    ),
    path(
        "jobs/<uuid:job_id>/submit/",
        AnnotationViewSet.as_view({"post": "submit_annotation"}),
    ),
    path(
        "jobs/<uuid:job_id>/discard/",
        AnnotationViewSet.as_view({"post": "discard_job"}),
    ),
    path(
        "my-jobs/",
        AnnotationViewSet.as_view({"get": "my_jobs"}),
    ),
]
