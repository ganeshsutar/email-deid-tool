import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

async function changeUserPassword(params: {
  id: string;
  newPassword: string;
}): Promise<void> {
  await apiClient.post(`/users/${params.id}/change-password/`, {
    new_password: params.newPassword,
  });
}

export function useChangeUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: changeUserPassword,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Password changed. User will be prompted to set a new password on next login.");
    },
  });
}
