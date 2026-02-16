import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { buildAvatarUrl } from "@/lib/avatar";
import type { AvatarConfig } from "@/types/models";
import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name: string;
  email: string;
  avatarConfig: AvatarConfig | null;
  className?: string;
  fallbackClassName?: string;
}

export function UserAvatar({
  name,
  email,
  avatarConfig,
  className,
  fallbackClassName,
}: UserAvatarProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const avatarUrl = buildAvatarUrl(avatarConfig, email, 128);

  return (
    <Avatar className={cn("h-8 w-8", className)}>
      <AvatarImage src={avatarUrl} alt={name} />
      <AvatarFallback className={fallbackClassName}>{initials}</AvatarFallback>
    </Avatar>
  );
}
