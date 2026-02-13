import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  mapAnnotatorPerformance,
  type AnnotatorPerformance,
} from "./dashboard-mapper";

export interface PerformanceDateParams {
  dateFrom?: string;
  dateTo?: string;
}

async function getAnnotatorPerformance(
  params: PerformanceDateParams,
): Promise<AnnotatorPerformance[]> {
  const response = await apiClient.get("/dashboard/annotator-performance/", {
    params: {
      ...(params.dateFrom && { date_from: params.dateFrom }),
      ...(params.dateTo && { date_to: params.dateTo }),
    },
  });
  return (response.data as Record<string, unknown>[]).map(
    mapAnnotatorPerformance,
  );
}

export function useAnnotatorPerformance(params: PerformanceDateParams = {}) {
  return useQuery({
    queryKey: ["dashboard", "annotator-performance", params.dateFrom, params.dateTo],
    queryFn: () => getAnnotatorPerformance(params),
  });
}
