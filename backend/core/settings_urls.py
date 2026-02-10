from django.urls import path

from .settings_views import blind_review_setting, min_annotation_length_setting

urlpatterns = [
    path("blind-review/", blind_review_setting),
    path("min-annotation-length/", min_annotation_length_setting),
]
