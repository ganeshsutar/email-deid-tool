from django.urls import path

from . import views

urlpatterns = [
    path("login/", views.LoginView.as_view(), name="auth-login"),
    path("logout/", views.LogoutView.as_view(), name="auth-logout"),
    path("me/", views.MeView.as_view(), name="auth-me"),
    path(
        "change-password/",
        views.ChangePasswordView.as_view(),
        name="auth-change-password",
    ),
    path(
        "forgot-password/",
        views.ForgotPasswordView.as_view(),
        name="auth-forgot-password",
    ),
    path(
        "reset-password/",
        views.ResetPasswordView.as_view(),
        name="auth-reset-password",
    ),
    path("avatar/", views.UpdateAvatarView.as_view(), name="auth-avatar"),
]
