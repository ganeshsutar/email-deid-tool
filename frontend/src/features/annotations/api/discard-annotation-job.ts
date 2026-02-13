import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface DiscardAnnotationJobParams {
  jobId: string;
  reason: string;
  expectedStatus?: string;
}

async function discardAnnotationJob({
  jobId,
  reason,
  expectedStatus,
}: DiscardAnnotationJobParams): Promise<void> {
  await apiClient.post(`/annotations/jobs/${jobId}/discard/`, {
    reason,
    expected_status: expectedStatus,
  });
}

export function useDiscardAnnotationJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discardAnnotationJob,
    onSuccess: (_data, { jobId }) => {
      queryClient.invalidateQueries({ queryKey: ["annotations", "my-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["annotations", "job", jobId] });
      toast.success("Job discarded");
    },
  });
}
