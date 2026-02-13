import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface UpdateDiscardReasonsParams {
  reasons: string[];
}

async function updateDiscardReasons(
  params: UpdateDiscardReasonsParams,
): Promise<{ reasons: string[] }> {
  const response = await apiClient.put("/settings/discard-reasons/", params);
  return response.data;
}

export function useUpdateDiscardReasons() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateDiscardReasons,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "discard-reasons"] });
      toast.success("Discard reasons updated");
    },
  });
}
