import type { Dataset } from "@/types/models";
import { mapUser } from "@/features/auth/api/user-mapper";

export interface DatasetSummary extends Dataset {
  statusSummary: Record<string, number>;
}

export function mapDataset(data: Record<string, unknown>): Dataset {
  return {
    id: data.id as string,
    name: data.name as string,
    uploadedBy: data.uploaded_by ? mapUser(data.uploaded_by as Record<string, unknown>) : null,
    uploadDate: data.upload_date as string,
    fileCount: data.file_count as number,
    duplicateCount: (data.duplicate_count as number) ?? 0,
    status: data.status as Dataset["status"],
    errorMessage: data.error_message as string,
  };
}

export function mapDatasetSummary(data: Record<string, unknown>): DatasetSummary {
  return {
    ...mapDataset(data),
    statusSummary: (data.status_summary as Record<string, number>) ?? {},
  };
}
