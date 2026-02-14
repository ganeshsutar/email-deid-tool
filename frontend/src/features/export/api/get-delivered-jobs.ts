import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { mapDeliveredJob, type DeliveredJob } from "./export-mapper";

async function getDeliveredJobs(datasetId: string): Promise<DeliveredJob[]> {
  const response = await apiClient.get(
    `/exports/datasets/${datasetId}/jobs/`,
  );
  return (response.data as Record<string, unknown>[]).map(mapDeliveredJob);
}

async function getAllDeliveredJobs(): Promise<DeliveredJob[]> {
  const response = await apiClient.get(`/exports/jobs/`);
  return (response.data as Record<string, unknown>[]).map(mapDeliveredJob);
}

export function useDeliveredJobs(datasetId: string | null) {
  return useQuery({
    queryKey: ["exports", "delivered-jobs", datasetId],
    queryFn: () => getDeliveredJobs(datasetId!),
    enabled: !!datasetId,
  });
}

export function useAllDeliveredJobs(enabled: boolean) {
  return useQuery({
    queryKey: ["exports", "delivered-jobs", "all"],
    queryFn: getAllDeliveredJobs,
    enabled,
  });
}
