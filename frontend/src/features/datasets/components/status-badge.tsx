import { Badge } from "@/components/ui/badge";
import { JobStatus, DatasetStatus } from "@/types/enums";

const JOB_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  [JobStatus.UPLOADED]: {
    label: "Uploaded",
    className: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-900/50 dark:text-gray-300 dark:border-gray-800",
  },
  [JobStatus.ASSIGNED_ANNOTATOR]: {
    label: "Assigned",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800",
  },
  [JobStatus.ANNOTATION_IN_PROGRESS]: {
    label: "Annotating",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800",
  },
  [JobStatus.SUBMITTED_FOR_QA]: {
    label: "Submitted for QA",
    className: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800",
  },
  [JobStatus.ASSIGNED_QA]: {
    label: "QA Assigned",
    className: "bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-300 dark:border-indigo-800",
  },
  [JobStatus.QA_IN_PROGRESS]: {
    label: "QA in Progress",
    className: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/50 dark:text-orange-300 dark:border-orange-800",
  },
  [JobStatus.QA_REJECTED]: {
    label: "Rejected",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800",
  },
  [JobStatus.QA_ACCEPTED]: {
    label: "Accepted",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
  },
  [JobStatus.DELIVERED]: {
    label: "Delivered",
    className: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-300 dark:border-emerald-800",
  },
  [JobStatus.DISCARDED]: {
    label: "Discarded",
    className: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-900/50 dark:text-slate-300 dark:border-slate-800",
  },
};

const DATASET_STATUS_CONFIG: Record<
  string,
  { label: string; className: string }
> = {
  [DatasetStatus.UPLOADING]: {
    label: "Uploading",
    className: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800",
  },
  [DatasetStatus.EXTRACTING]: {
    label: "Extracting",
    className: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800",
  },
  [DatasetStatus.READY]: {
    label: "Ready",
    className: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800",
  },
  [DatasetStatus.FAILED]: {
    label: "Failed",
    className: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800",
  },
};

interface StatusBadgeProps {
  status: string;
  type?: "job" | "dataset";
}

export function StatusBadge({ status, type = "job" }: StatusBadgeProps) {
  const config =
    type === "dataset"
      ? DATASET_STATUS_CONFIG[status]
      : JOB_STATUS_CONFIG[status];

  if (!config) {
    return <Badge variant="outline">{status}</Badge>;
  }

  return (
    <Badge
      variant="outline"
      className={`transition-colors duration-200 ${config.className}`}
      {...(type === "dataset" ? { "data-testid": "dataset-status" } : {})}
    >
      {config.label}
    </Badge>
  );
}
