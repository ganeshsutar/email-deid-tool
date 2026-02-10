import type { Job } from "@/types/models";
import { mapUser } from "@/features/auth/api/user-mapper";

export interface JobWithDatasetName extends Job {
  datasetName: string;
}

export function mapJob(data: Record<string, unknown>): Job {
  return {
    id: data.id as string,
    dataset: data.dataset as string,
    fileName: data.file_name as string,
    status: data.status as Job["status"],
    assignedAnnotator: data.assigned_annotator
      ? mapUser(data.assigned_annotator as Record<string, unknown>)
      : null,
    assignedQa: data.assigned_qa
      ? mapUser(data.assigned_qa as Record<string, unknown>)
      : null,
    createdAt: data.created_at as string,
    updatedAt: data.updated_at as string,
  };
}

export function mapJobWithDatasetName(data: Record<string, unknown>): JobWithDatasetName {
  return {
    ...mapJob(data),
    datasetName: data.dataset_name as string,
  };
}
