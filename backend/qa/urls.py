from django.urls import path

from .views import QAViewSet

urlpatterns = [
    path(
        "settings/blind-review/",
        QAViewSet.as_view({"get": "blind_review_setting"}),
    ),
    path(
        "jobs/<uuid:job_id>/",
        QAViewSet.as_view({"get": "get_job"}),
    ),
    path(
        "jobs/<uuid:job_id>/raw-content/",
        QAViewSet.as_view({"get": "get_raw_content"}),
    ),
    path(
        "jobs/<uuid:job_id>/start/",
        QAViewSet.as_view({"post": "start_qa_review"}),
    ),
    path(
        "jobs/<uuid:job_id>/accept/",
        QAViewSet.as_view({"post": "accept_annotation"}),
    ),
    path(
        "jobs/<uuid:job_id>/reject/",
        QAViewSet.as_view({"post": "reject_annotation"}),
    ),
    path(
        "jobs/<uuid:job_id>/discard/",
        QAViewSet.as_view({"post": "discard_job"}),
    ),
    path(
        "my-jobs/",
        QAViewSet.as_view({"get": "my_jobs"}),
    ),
    path(
        "jobs/<uuid:job_id>/draft/",
        QAViewSet.as_view({"get": "get_qa_draft", "put": "save_qa_draft"}),
    ),
]
