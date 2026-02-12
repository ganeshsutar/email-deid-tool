import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  mapAnnotationJobResponse,
  type AnnotationJobResponse,
} from "./annotation-mapper";

async function getJobForAnnotation(
  jobId: string,
): Promise<AnnotationJobResponse> {
  const response = await apiClient.get(`/annotations/jobs/${jobId}/`);
  return mapAnnotationJobResponse(response.data);
}

export interface RawContentResponse {
  rawContent: string;
  sections: import("@/types/models").EmailSection[];
}

async function getRawContent(jobId: string): Promise<RawContentResponse> {
  const response = await apiClient.get(
    `/annotations/jobs/${jobId}/raw-content/`,
  );
  return {
    rawContent: response.data.raw_content,
    sections: response.data.sections as import("@/types/models").EmailSection[],
  };
}

export function useJobForAnnotation(jobId: string) {
  return useQuery({
    queryKey: ["annotations", "job", jobId],
    queryFn: () => getJobForAnnotation(jobId),
    enabled: !!jobId,
  });
}

export function useRawContent(jobId: string) {
  return useQuery({
    queryKey: ["annotations", "job", jobId, "raw-content"],
    queryFn: () => getRawContent(jobId),
    enabled: !!jobId,
  });
}
