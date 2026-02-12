import type { WorkspaceAnnotation } from "@/types/models";

export interface AnnotationJobResponse {
  id: string;
  dataset: string;
  datasetName: string;
  fileName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  rawContentUrl: string;
  latestAnnotations: WorkspaceAnnotation[];
  reworkInfo: ReworkInfo | null;
  minAnnotationLength: number;
}

export interface ReworkInfo {
  comments: string;
  reviewerName: string | null;
  reviewerId: string | null;
  reviewedAt: string;
}

export interface MyAnnotationJob {
  id: string;
  dataset: string;
  datasetName: string;
  fileName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  annotationCount: number;
  reworkInfo: ReworkInfo | null;
}

function mapReworkInfo(data: Record<string, unknown> | null): ReworkInfo | null {
  if (!data) return null;
  return {
    comments: data.comments as string,
    reviewerName: data.reviewer_name as string | null,
    reviewerId: data.reviewer_id as string | null,
    reviewedAt: data.reviewed_at as string,
  };
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

export function mapAnnotationJobResponse(
  data: Record<string, unknown>,
): AnnotationJobResponse {
  const latestAnnotations = (
    data.latest_annotations as Record<string, unknown>[]
  ).map(mapServerAnnotation);

  return {
    id: data.id as string,
    dataset: data.dataset as string,
    datasetName: data.dataset_name as string,
    fileName: data.file_name as string,
    status: data.status as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    rawContentUrl: data.raw_content_url as string,
    latestAnnotations,
    reworkInfo: mapReworkInfo(data.rework_info as Record<string, unknown> | null),
    minAnnotationLength: (data.min_annotation_length as number) ?? 1,
  };
}

export function mapMyAnnotationJob(
  data: Record<string, unknown>,
): MyAnnotationJob {
  return {
    id: data.id as string,
    dataset: data.dataset as string,
    datasetName: data.dataset_name as string,
    fileName: data.file_name as string,
    status: data.status as string,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
    annotationCount: data.annotation_count as number,
    reworkInfo: mapReworkInfo(data.rework_info as Record<string, unknown> | null),
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
