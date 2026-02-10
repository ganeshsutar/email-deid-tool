import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

async function startQAReview(jobId: string): Promise<void> {
  await apiClient.post(`/qa/jobs/${jobId}/start/`);
}

export function useStartQAReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: startQAReview,
    onSuccess: (_data, jobId) => {
      queryClient.invalidateQueries({ queryKey: ["qa", "my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["qa", "job", jobId] });
      toast.success("QA review started");
    },
  });
}
