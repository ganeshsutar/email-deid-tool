import type { WorkspaceAnnotation } from "@/types/models";

export interface AnnotationVersionSummary {
  id: string;
  versionNumber: number;
  createdBy: { id: string; name: string } | null;
  source: string;
  annotationCount: number;
  createdAt: string;
}

export interface QAReviewVersionSummary {
  id: string;
  versionNumber: number;
  annotationVersionId: string;
  reviewedBy: { id: string; name: string } | null;
  decision: string;
  comments: string;
  modificationsSummary: string;
  reviewedAt: string;
}

export interface VersionAnnotation extends WorkspaceAnnotation {}

export interface VersionHistoryJobInfo {
  id: string;
  fileName: string;
  datasetName: string;
  status: string;
  createdAt: string;
}

export function mapAnnotationVersionSummary(
  data: Record<string, unknown>,
): AnnotationVersionSummary {
  const createdBy = data.created_by as { id: string; name: string } | null;
  return {
    id: data.id as string,
    versionNumber: data.version_number as number,
    createdBy,
    source: data.source as string,
    annotationCount: data.annotation_count as number,
    createdAt: data.created_at as string,
  };
}

export function mapQAReviewVersionSummary(
  data: Record<string, unknown>,
): QAReviewVersionSummary {
  const reviewedBy = data.reviewed_by as { id: string; name: string } | null;
  return {
    id: data.id as string,
    versionNumber: data.version_number as number,
    annotationVersionId: data.annotation_version as string,
    reviewedBy,
    decision: data.decision as string,
    comments: data.comments as string,
    modificationsSummary: data.modifications_summary as string,
    reviewedAt: data.reviewed_at as string,
  };
}

export function mapVersionAnnotation(
  data: Record<string, unknown>,
): VersionAnnotation {
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

export function mapJobInfo(
  data: Record<string, unknown>,
): VersionHistoryJobInfo {
  return {
    id: data.id as string,
    fileName: data.file_name as string,
    datasetName: data.dataset_name as string,
    status: data.status as string,
    createdAt: data.created_at as string,
  };
}
