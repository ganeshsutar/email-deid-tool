import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { ExcludedFileHash } from "@/types/models";

interface ExcludedHashesParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

interface ExcludedHashesResponse {
  count: number;
  results: ExcludedFileHash[];
}

function mapExcludedFileHash(data: Record<string, unknown>): ExcludedFileHash {
  return {
    id: data.id as string,
    contentHash: data.content_hash as string,
    fileName: data.file_name as string,
    note: data.note as string,
    createdBy: data.created_by as ExcludedFileHash["createdBy"],
    createdAt: data.created_at as string,
  };
}

async function getExcludedHashes(
  params: ExcludedHashesParams,
): Promise<ExcludedHashesResponse> {
  const response = await apiClient.get("/excluded-hashes/", {
    params: {
      page: params.page ?? 1,
      page_size: params.pageSize ?? 20,
      search: params.search || undefined,
    },
  });
  return {
    count: response.data.count,
    results: (response.data.results as Record<string, unknown>[]).map(
      mapExcludedFileHash,
    ),
  };
}

export function useExcludedHashes(params: ExcludedHashesParams = {}) {
  return useQuery({
    queryKey: ["excluded-hashes", params],
    queryFn: () => getExcludedHashes(params),
  });
}
