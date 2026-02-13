import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

interface DiscardQAJobParams {
  jobId: string;
  reason: string;
  expectedStatus?: string;
}

async function discardQAJob({
  jobId,
  reason,
  expectedStatus,
}: DiscardQAJobParams): Promise<void> {
  await apiClient.post(`/qa/jobs/${jobId}/discard/`, {
    reason,
    expected_status: expectedStatus,
  });
}

export function useDiscardQAJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discardQAJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["qa", "my-jobs"] });
      toast.success("Job discarded");
    },
  });
}
