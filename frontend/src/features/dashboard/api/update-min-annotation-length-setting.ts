import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface UpdateMinAnnotationLengthParams {
  minLength: number;
}

async function updateMinAnnotationLengthSetting(
  params: UpdateMinAnnotationLengthParams,
): Promise<{ min_length: number }> {
  const response = await apiClient.put("/settings/min-annotation-length/", {
    min_length: params.minLength,
  });
  return response.data;
}

export function useUpdateMinAnnotationLengthSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateMinAnnotationLengthSetting,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings", "min-annotation-length"] });
      toast.success("Minimum annotation length updated");
    },
  });
}
