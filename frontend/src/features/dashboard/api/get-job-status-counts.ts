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

export interface DatasetStatusCount {
  status: string;
  dataset_id: string;
  dataset_name: string;
  count: number;
}

async function getJobStatusCountsByDataset(
  params: JobStatusCountsParams,
): Promise<DatasetStatusCount[]> {
  const queryParams: Record<string, string> = {};
  if (params.datasetIds && params.datasetIds.length > 0) {
    queryParams.dataset_ids = params.datasetIds.join(",");
  }
  const response = await apiClient.get(
    "/dashboard/job-status-counts-by-dataset/",
    { params: queryParams },
  );
  return response.data;
}

export function useJobStatusCountsByDataset(
  params: JobStatusCountsParams = {},
  enabled = false,
) {
  const sortedIds = params.datasetIds ? [...params.datasetIds].sort() : [];
  return useQuery({
    queryKey: [
      "dashboard",
      "job-status-counts-by-dataset",
      sortedIds.length > 0 ? sortedIds.join(",") : "all",
    ],
    queryFn: () => getJobStatusCountsByDataset(params),
    enabled,
  });
}
