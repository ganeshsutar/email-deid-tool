import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { EmailSection, WorkspaceAnnotation } from "@/types/models";

interface AnnotatedContentResponse {
  hasAnnotations: boolean;
  rawContent: string;
  sections: EmailSection[];
  annotations: WorkspaceAnnotation[];
}

function mapServerAnnotation(
  data: Record<string, unknown>,
): WorkspaceAnnotation {
  return {
    id: data.id as string,
    classId: data.annotation_class as string,
    className: data.class_name as string,
    classColor: data.class_color as string,
    classDisplayLabel: data.class_display_label as string,
    tag: data.tag as string,
    sectionIndex: (data.section_index as number) ?? 0,
    startOffset: data.start_offset as number,
    endOffset: data.end_offset as number,
    originalText: data.original_text as string,
  };
}

function mapSection(data: Record<string, unknown>): EmailSection {
  return {
    index: data.index as number,
    type: data.type as string,
    label: data.label as string,
    content: data.content as string,
  };
}

async function getJobAnnotatedContent(
  jobId: string,
): Promise<AnnotatedContentResponse> {
  const response = await apiClient.get(`/jobs/${jobId}/annotated-content/`);
  const data = response.data as Record<string, unknown>;
  return {
    hasAnnotations: data.has_annotations as boolean,
    rawContent: data.raw_content as string,
    sections: (data.sections as Record<string, unknown>[]).map(mapSection),
    annotations: (data.annotations as Record<string, unknown>[]).map(
      mapServerAnnotation,
    ),
  };
}

export function useJobAnnotatedContent(jobId: string | null) {
  return useQuery({
    queryKey: ["jobs", jobId, "annotated-content"],
    queryFn: () => getJobAnnotatedContent(jobId!),
    enabled: !!jobId,
  });
}
