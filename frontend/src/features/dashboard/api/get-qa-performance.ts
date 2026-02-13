import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { mapQAPerformance, type QAPerformance } from "./dashboard-mapper";
import type { PerformanceDateParams } from "./get-annotator-performance";

async function getQAPerformance(
  params: PerformanceDateParams,
): Promise<QAPerformance[]> {
  const response = await apiClient.get("/dashboard/qa-performance/", {
    params: {
      ...(params.dateFrom && { date_from: params.dateFrom }),
      ...(params.dateTo && { date_to: params.dateTo }),
    },
  });
  return (response.data as Record<string, unknown>[]).map(mapQAPerformance);
}

export function useQAPerformance(params: PerformanceDateParams = {}) {
  return useQuery({
    queryKey: ["dashboard", "qa-performance", params.dateFrom, params.dateTo],
    queryFn: () => getQAPerformance(params),
  });
}
