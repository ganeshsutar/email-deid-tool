import secrets
import string

from django.contrib.auth import login, logout, update_session_auth_hash
from django.db.models import Q
from rest_framework import status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.viewsets import ViewSet

from core.permissions import IsAdmin
from datasets.models import Job

from .models import User
from .serializers import (
    AdminChangePasswordSerializer,
    ChangePasswordSerializer,
    CreateUserSerializer,
    ForgotPasswordSerializer,
    LoginSerializer,
    ResetPasswordSerializer,
    UpdateAvatarSerializer,
    UpdateUserSerializer,
    UserSerializer,
)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        login(request, user)
        return Response(UserSerializer(user).data)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response({"detail": "Logged out."})


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(
            data=request.data, context={"user": request.user}
        )
        serializer.is_valid(raise_exception=True)
        request.user.set_password(serializer.validated_data["new_password"])
        request.user.force_password_change = False
        request.user.save(update_fields=["password", "force_password_change"])
        update_session_auth_hash(request, request.user)
        return Response(UserSerializer(request.user).data)


class ForgotPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Stub — always return success to prevent email enumeration
        return Response(
            {"detail": "If that email exists, a reset link has been sent."}
        )


class ResetPasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # Stub — no email service configured
        return Response({"detail": "Password has been reset."})


class UpdateAvatarView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        serializer = UpdateAvatarSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        request.user.avatar_config = serializer.validated_data["avatar_config"]
        request.user.save(update_fields=["avatar_config"])
        return Response(UserSerializer(request.user).data)


def _generate_temp_password(length=12):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


class UserViewSet(ViewSet):
    permission_classes = [IsAuthenticated, IsAdmin]

    def list(self, request):
        queryset = User.objects.all().order_by("-created_at")

        search = request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) | Q(email__icontains=search)
            )

        role = request.query_params.get("role", "").strip()
        if role:
            queryset = queryset.filter(role=role)

        status_filter = request.query_params.get("status", "").strip()
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Pagination
        page = int(request.query_params.get("page", 1))
        page_size = int(request.query_params.get("page_size", 20))
        total = queryset.count()
        start = (page - 1) * page_size
        end = start + page_size
        users = queryset[start:end]

        return Response(
            {
                "count": total,
                "results": UserSerializer(users, many=True).data,
            }
        )

    def create(self, request):
        serializer = CreateUserSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        temp_password = _generate_temp_password()
        user = User.objects.create_user(
            email=data["email"],
            name=data["name"],
            role=data["role"],
            password=temp_password,
            force_password_change=True,
        )

        response_data = UserSerializer(user).data
        response_data["temp_password"] = temp_password
        return Response(response_data, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = UpdateUserSerializer(
            data=request.data, context={"user": user}
        )
        serializer.is_valid(raise_exception=True)

        for attr, value in serializer.validated_data.items():
            setattr(user, attr, value)
        user.save(update_fields=list(serializer.validated_data.keys()))

        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"])
    def deactivate(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        if (
            user.role == User.Role.ADMIN
            and User.objects.filter(role=User.Role.ADMIN, is_active=True).count() <= 1
        ):
            return Response(
                {"detail": "Cannot deactivate the last admin user."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.is_active = False
        user.status = User.Status.INACTIVE
        user.save(update_fields=["is_active", "status"])

        # Unassign from ASSIGNED jobs (not in-progress ones)
        Job.objects.filter(
            assigned_annotator=user,
            status=Job.Status.ASSIGNED_ANNOTATOR,
        ).update(assigned_annotator=None, status=Job.Status.UPLOADED)

        Job.objects.filter(
            assigned_qa=user,
            status=Job.Status.ASSIGNED_QA,
        ).update(assigned_qa=None, status=Job.Status.SUBMITTED_FOR_QA)

        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        user.is_active = True
        user.status = User.Status.ACTIVE
        user.save(update_fields=["is_active", "status"])
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["post"], url_path="change-password")
    def change_password(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        serializer = AdminChangePasswordSerializer(
            data=request.data, context={"user": user}
        )
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data["new_password"])
        user.force_password_change = True
        user.save(update_fields=["password", "force_password_change"])
        return Response(UserSerializer(user).data)

    @action(detail=True, methods=["get"])
    def job_impact(self, request, pk=None):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        annotator_count = Job.objects.filter(
            assigned_annotator=user,
            status=Job.Status.ASSIGNED_ANNOTATOR,
        ).count()

        qa_count = Job.objects.filter(
            assigned_qa=user,
            status=Job.Status.ASSIGNED_QA,
        ).count()

        return Response(
            {
                "user_id": str(user.id),
                "assigned_annotator_jobs": annotator_count,
                "assigned_qa_jobs": qa_count,
                "total": annotator_count + qa_count,
            }
        )
