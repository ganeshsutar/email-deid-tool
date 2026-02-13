import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface JobStatusCountsParams {
  datasetIds?: string[];
}

async function getJobStatusCounts(
  params: JobStatusCountsParams,
): Promise<Record<string, number>> {
  const queryParams: Record<string, string> = {};
  if (params.datasetIds && params.datasetIds.length > 0) {
    queryParams.dataset_ids = params.datasetIds.join(",");
  }
  const response = await apiClient.get("/dashboard/job-status-counts/", {
    params: queryParams,
  });
  return response.data;
}

export function useJobStatusCounts(params: JobStatusCountsParams = {}) {
  const sortedIds = params.datasetIds ? [...params.datasetIds].sort() : [];
  return useQuery({
    queryKey: [
      "dashboard",
      "job-status-counts",
      sortedIds.length > 0 ? sortedIds.join(",") : "all",
    ],
    queryFn: () => getJobStatusCounts(params),
  });
}
