import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { mapQAJobResponse, type QAJobResponse } from "./qa-review-mapper";

async function getJobForQAReview(jobId: string): Promise<QAJobResponse> {
  const response = await apiClient.get(`/qa/jobs/${jobId}/`);
  return mapQAJobResponse(response.data);
}

export interface QARawContentResponse {
  rawContent: string;
  sections: import("@/types/models").EmailSection[];
}

async function getQARawContent(jobId: string): Promise<QARawContentResponse> {
  const response = await apiClient.get(`/qa/jobs/${jobId}/raw-content/`);
  return {
    rawContent: response.data.raw_content,
    sections: response.data.sections as import("@/types/models").EmailSection[],
  };
}

export function useJobForQAReview(jobId: string) {
  return useQuery({
    queryKey: ["qa", "job", jobId],
    queryFn: () => getJobForQAReview(jobId),
    enabled: !!jobId,
  });
}

export function useQARawContent(jobId: string) {
  return useQuery({
    queryKey: ["qa", "job", jobId, "raw-content"],
    queryFn: () => getQARawContent(jobId),
    enabled: !!jobId,
  });
}
