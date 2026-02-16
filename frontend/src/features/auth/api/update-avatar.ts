import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";
import type { User, AvatarConfig } from "@/types/models";
import { mapUser } from "./user-mapper";

async function updateAvatar(avatarConfig: AvatarConfig): Promise<User> {
  const response = await apiClient.put("/auth/avatar/", {
    avatar_config: avatarConfig,
  });
  return mapUser(response.data);
}

export function useUpdateAvatar() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateAvatar,
    onSuccess: (user) => {
      queryClient.setQueryData(["auth", "me"], user);
      toast.success("Avatar updated");
    },
  });
}
