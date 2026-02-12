import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { apiClient } from "@/lib/api-client";

async function deleteJob({
  jobId,
  force,
}: {
  jobId: string;
  force?: boolean;
}): Promise<void> {
  await apiClient.delete(
    `/jobs/${jobId}/${force ? "?force=true" : ""}`,
  );
}

async function deleteJobsBulk({
  jobIds,
  force,
}: {
  jobIds: string[];
  force?: boolean;
}): Promise<{ deleted: number }> {
  const response = await apiClient.post<{ deleted: number }>(
    "/jobs/delete-bulk/",
    { job_ids: jobIds, force: !!force },
  );
  return response.data;
}

export function useDeleteJob(datasetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteJob,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Job deleted");
    },
  });
}

export function useDeleteJobs(datasetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteJobsBulk,
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId, "jobs"] });
      queryClient.invalidateQueries({ queryKey: ["datasets", datasetId] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Jobs deleted");
    },
  });
}
