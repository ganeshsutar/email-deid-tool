import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { JobWithDatasetName } from "@/features/datasets/api/job-mapper";
import { mapJobWithDatasetName } from "@/features/datasets/api/job-mapper";

export interface InProgressJobsParams {
  type: "ANNOTATION" | "QA";
  page?: number;
  pageSize?: number;
  search?: string;
  datasetId?: string;
  assigneeId?: string;
}

interface InProgressJobsResponse {
  count: number;
  results: JobWithDatasetName[];
}

async function getInProgressJobs(
  params: InProgressJobsParams,
): Promise<InProgressJobsResponse> {
  const response = await apiClient.get("/jobs/in-progress/", {
    params: {
      type: params.type,
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      search: params.search || undefined,
      dataset_id: params.datasetId || undefined,
      assignee_id: params.assigneeId || undefined,
    },
  });
  return {
    count: response.data.count,
    results: response.data.results.map(mapJobWithDatasetName),
  };
}

export function useInProgressJobs(params: InProgressJobsParams) {
  return useQuery({
    queryKey: ["jobs", "in-progress", params],
    queryFn: () => getInProgressJobs(params),
    placeholderData: keepPreviousData,
  });
}
