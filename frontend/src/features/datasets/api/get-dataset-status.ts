import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { DatasetStatus } from "@/types/enums";

interface DatasetStatusResponse {
  id: string;
  status: DatasetStatus;
  fileCount: number;
  duplicateCount: number;
  errorMessage: string;
}

async function getDatasetStatus(id: string): Promise<DatasetStatusResponse> {
  const response = await apiClient.get(`/datasets/${id}/status/`);
  return {
    id: response.data.id,
    status: response.data.status,
    fileCount: response.data.file_count,
    duplicateCount: response.data.duplicate_count ?? 0,
    errorMessage: response.data.error_message,
  };
}

export function useDatasetStatus(id: string, enabled: boolean) {
  return useQuery({
    queryKey: ["datasets", id, "status"],
    queryFn: () => getDatasetStatus(id),
    enabled,
    refetchInterval: enabled ? 2000 : false,
  });
}
