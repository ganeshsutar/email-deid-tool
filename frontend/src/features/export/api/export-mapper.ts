import type { EmailSection, WorkspaceAnnotation } from "@/types/models";

export interface ExportDataset {
  id: string;
  name: string;
  deliveredCount: number;
}

export interface DeliveredJob {
  id: string;
  fileName: string;
  annotator: { id: string; name: string } | null;
  qaReviewer: { id: string; name: string } | null;
  annotationCount: number;
  deliveredDate: string;
  datasetName?: string;
}

export interface ExportRecord {
  id: string;
  datasetName: string;
  jobCount: number;
  fileSize: number;
  exportedBy: { id: string; name: string } | null;
  exportedAt: string;
  downloadUrl: string;
}

export interface ExportPreview {
  jobId: string;
  fileName: string;
  original: string;
  deidentified: string;
  annotations: WorkspaceAnnotation[];
  sections: EmailSection[];
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

export function mapDatasetWithDelivered(
  data: Record<string, unknown>,
): ExportDataset {
  return {
    id: data.id as string,
    name: data.name as string,
    deliveredCount: data.delivered_count as number,
  };
}

export function mapDeliveredJob(
  data: Record<string, unknown>,
): DeliveredJob {
  return {
    id: data.id as string,
    fileName: data.file_name as string,
    annotator: data.assigned_annotator as { id: string; name: string } | null,
    qaReviewer: data.assigned_qa as { id: string; name: string } | null,
    annotationCount: data.annotation_count as number,
    deliveredDate: data.delivered_date as string,
    datasetName: (data.dataset_name as string) || undefined,
  };
}

export function mapExportRecord(
  data: Record<string, unknown>,
): ExportRecord {
  const exportedBy = data.exported_by as {
    id: string;
    name: string;
  } | null;
  return {
    id: data.id as string,
    datasetName: data.dataset_name as string,
    jobCount: data.job_count as number,
    fileSize: data.file_size as number,
    exportedBy,
    exportedAt: data.exported_at as string,
    downloadUrl: data.download_url as string,
  };
}

export function mapExportPreview(
  data: Record<string, unknown>,
): ExportPreview {
  return {
    jobId: data.job_id as string,
    fileName: data.file_name as string,
    original: data.original as string,
    deidentified: data.deidentified as string,
    annotations: (data.annotations as Record<string, unknown>[]).map(
      mapServerAnnotation,
    ),
    sections: (data.sections as Array<Record<string, unknown>>).map((s) => ({
      index: s.index as number,
      type: s.type as string,
      label: s.label as string,
      content: s.content as string,
    })),
  };
}
