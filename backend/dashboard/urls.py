from django.urls import path

from .views import DashboardViewSet

urlpatterns = [
    path(
        "stats/",
        DashboardViewSet.as_view({"get": "stats"}),
    ),
    path(
        "job-status-counts/",
        DashboardViewSet.as_view({"get": "job_status_counts"}),
    ),
    path(
        "job-status-counts-by-dataset/",
        DashboardViewSet.as_view({"get": "job_status_counts_by_dataset"}),
    ),
    path(
        "recent-datasets/",
        DashboardViewSet.as_view({"get": "recent_datasets"}),
    ),
    path(
        "annotator-performance/",
        DashboardViewSet.as_view({"get": "annotator_performance"}),
    ),
    path(
        "qa-performance/",
        DashboardViewSet.as_view({"get": "qa_performance"}),
    ),
    path(
        "job-csv-export/",
        DashboardViewSet.as_view({"get": "job_csv_export"}),
    ),
]
