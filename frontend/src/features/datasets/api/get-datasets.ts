import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DatasetSummary } from "./dataset-mapper";
import { mapDatasetSummary } from "./dataset-mapper";

export interface DatasetsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
}

interface DatasetsResponse {
  count: number;
  results: DatasetSummary[];
}

async function getDatasets(params: DatasetsParams): Promise<DatasetsResponse> {
  const response = await apiClient.get("/datasets/", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      search: params.search || undefined,
      status: params.status || undefined,
    },
  });
  return {
    count: response.data.count,
    results: response.data.results.map(mapDatasetSummary),
  };
}

export function useDatasets(params: DatasetsParams) {
  return useQuery({
    queryKey: ["datasets", params],
    queryFn: () => getDatasets(params),
    placeholderData: keepPreviousData,
  });
}
