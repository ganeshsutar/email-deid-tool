import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

interface MinAnnotationLengthSetting {
  minLength: number;
}

async function getMinAnnotationLengthSetting(): Promise<MinAnnotationLengthSetting> {
  const response = await apiClient.get("/settings/min-annotation-length/");
  return { minLength: response.data.min_length };
}

export function useMinAnnotationLengthSetting() {
  return useQuery({
    queryKey: ["settings", "min-annotation-length"],
    queryFn: getMinAnnotationLengthSetting,
  });
}
