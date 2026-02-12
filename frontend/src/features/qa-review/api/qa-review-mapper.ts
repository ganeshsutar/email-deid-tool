import type { WorkspaceAnnotation } from "@/types/models";

export interface QAJobResponse {
  id: string;
  dataset: string;
  datasetName: string;
  fileName: string;
  status: string;
  assignedQa: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  rawContentUrl: string;
  annotatorInfo: { id: string; name: string } | null;
  annotations: WorkspaceAnnotation[];
  annotationVersionId: string | null;
}

export interface MyQAJob {
  id: string;
  dataset: string;
  datasetName: string;
  fileName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  annotatorName: string | null;
  annotationCount: number;
}

function mapServerAnnotation(data: Record<string, unknown>): WorkspaceAnnotation {
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

export function mapQAJobResponse(data: Record<string, unknown>): QAJobResponse {
  const assignedQa = data.assigned_qa as { id: string; name: string } | null;
  const annotatorInfo = data.annotator_info as { id: string; name: string } | null;
  const annotations = (data.annotations as Record<string, unknown>[]).map(
    mapServerAnnotation,
  );

  return {
    id: data.id as string,
    dataset: data.dataset as string,
    datasetName: data.dataset_name as string,
    fileName: data.file_name as string,
    status: data.status as string,
    assignedQa,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    rawContentUrl: data.raw_content_url as string,
    annotatorInfo,
    annotations,
    annotationVersionId: data.annotation_version_id as string | null,
  };
}

export function mapMyQAJob(data: Record<string, unknown>): MyQAJob {
  return {
    id: data.id as string,
    dataset: data.dataset as string,
    datasetName: data.dataset_name as string,
    fileName: data.file_name as string,
    status: data.status as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    annotatorName: data.annotator_name as string | null,
    annotationCount: data.annotation_count as number,
  };
}

export function workspaceAnnotationToServer(ann: WorkspaceAnnotation): Record<string, unknown> {
  return {
    annotation_class: ann.classId,
    class_name: ann.className,
    tag: ann.tag,
    section_index: ann.sectionIndex,
    start_offset: ann.startOffset,
    end_offset: ann.endOffset,
    original_text: ann.originalText,
  };
}
