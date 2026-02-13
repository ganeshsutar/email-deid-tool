import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface DiscardReasonsResponse {
  reasons: string[];
}

async function getDiscardReasons(): Promise<DiscardReasonsResponse> {
  const response = await apiClient.get("/settings/discard-reasons/");
  return response.data;
}

export function useDiscardReasons() {
  return useQuery({
    queryKey: ["settings", "discard-reasons"],
    queryFn: getDiscardReasons,
  });
}
