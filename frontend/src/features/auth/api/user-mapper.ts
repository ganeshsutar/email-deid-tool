import type { User, AvatarConfig } from "@/types/models";

export function mapUser(data: Record<string, unknown>): User {
  return {
    id: data.id as string,
    name: data.name as string,
    email: data.email as string,
    role: data.role as User["role"],
    status: data.status as User["status"],
    forcePasswordChange: data.force_password_change as boolean,
    avatarConfig: (data.avatar_config as AvatarConfig | null) ?? null,
    createdAt: data.created_at as string,
  };
}
