import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

async function resetJob({
  jobId,
  expectedStatus,
}: {
  jobId: string;
  expectedStatus?: string;
}): Promise<{ status: string }> {
  const response = await apiClient.post<{ status: string }>(
    `/jobs/${jobId}/reset/`,
    expectedStatus ? { expected_status: expectedStatus } : {},
  );
  return response.data;
}

async function resetJobsBulk({
  jobIds,
}: {
  jobIds: string[];
}): Promise<{ reset: number }> {
  const response = await apiClient.post<{ reset: number }>(
    "/jobs/reset-bulk/",
    { job_ids: jobIds },
  );
  return response.data;
}

export function useResetJob(datasetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast.success("Job reset to Uploaded");
    },
  });
}

export function useResetJobs(datasetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: resetJobsBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["datasets"] });
      toast.success("Jobs reset to Uploaded");
    },
  });
}
