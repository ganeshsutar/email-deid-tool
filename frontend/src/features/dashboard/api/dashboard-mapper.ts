export interface DashboardStats {
  totalDatasets: number;
  totalJobs: number;
  pendingAssignment: number;
  inProgress: number;
  delivered: number;
  awaitingQa: number;
  discarded: number;
}

export interface AnnotatorPerformance {
  id: string;
  name: string;
  assignedJobs: number;
  completedJobs: number;
  inProgressJobs: number;
  acceptanceRate: number | null;
  avgAnnotationsPerJob: number | null;
}

export interface QAPerformance {
  id: string;
  name: string;
  reviewedJobs: number;
  acceptedJobs: number;
  rejectedJobs: number;
  inReviewJobs: number;
  avgReviewTime: string | null;
  assignedJobs: number;
  completedJobs: number;
  acceptanceRate: number | null;
}

export interface RecentDataset {
  id: string;
  name: string;
  uploadedBy: { id: string; name: string } | null;
  uploadDate: string;
  fileCount: number;
  status: string;
  statusSummary: Record<string, number>;
}

export function mapDashboardStats(
  data: Record<string, unknown>,
): DashboardStats {
  return {
    totalDatasets: data.total_datasets as number,
    totalJobs: data.total_jobs as number,
    pendingAssignment: data.pending_assignment as number,
    inProgress: data.in_progress as number,
    delivered: data.delivered as number,
    awaitingQa: data.awaiting_qa as number,
    discarded: (data.discarded as number) ?? 0,
  };
}

export function mapAnnotatorPerformance(
  data: Record<string, unknown>,
): AnnotatorPerformance {
  return {
    id: data.id as string,
    name: data.name as string,
    assignedJobs: data.assigned_jobs as number,
    completedJobs: data.completed_jobs as number,
    inProgressJobs: data.in_progress_jobs as number,
    acceptanceRate: data.acceptance_rate as number | null,
    avgAnnotationsPerJob: data.avg_annotations_per_job as number | null,
  };
}

export function mapQAPerformance(
  data: Record<string, unknown>,
): QAPerformance {
  return {
    id: data.id as string,
    name: data.name as string,
    reviewedJobs: data.reviewed_jobs as number,
    acceptedJobs: data.accepted_jobs as number,
    rejectedJobs: data.rejected_jobs as number,
    inReviewJobs: data.in_review_jobs as number,
    avgReviewTime: data.avg_review_time as string | null,
    assignedJobs: data.assigned_jobs as number,
    completedJobs: data.completed_jobs as number,
    acceptanceRate: data.acceptance_rate as number | null,
  };
}

export function mapRecentDataset(
  data: Record<string, unknown>,
): RecentDataset {
  const uploadedBy = data.uploaded_by as { id: string; name: string } | null;
  return {
    id: data.id as string,
    name: data.name as string,
    uploadedBy,
    uploadDate: data.upload_date as string,
    fileCount: data.file_count as number,
    status: data.status as string,
    statusSummary: (data.status_summary as Record<string, number>) ?? {},
  };
}
