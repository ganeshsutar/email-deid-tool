import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { WorkspaceAnnotation } from "@/types/models";

interface SaveDraftParams {
  jobId: string;
  annotations: WorkspaceAnnotation[];
}

async function saveDraft({ jobId, annotations }: SaveDraftParams): Promise<void> {
  await apiClient.put(`/annotations/jobs/${jobId}/draft/`, { annotations });
}

export function useSaveDraft() {
  return useMutation({
    mutationFn: saveDraft,
  });
}
