import { Card, CardContent } from "@/components/ui/card";
import { JobStatus } from "@/types/enums";

const STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
  [JobStatus.UPLOADED]: { label: "Uploaded", color: "bg-gray-500" },
  [JobStatus.ASSIGNED_ANNOTATOR]: { label: "Assigned", color: "bg-blue-500" },
  [JobStatus.ANNOTATION_IN_PROGRESS]: {
    label: "Annotating",
    color: "bg-yellow-500",
  },
  [JobStatus.SUBMITTED_FOR_QA]: {
    label: "Submitted for QA",
    color: "bg-purple-500",
  },
  [JobStatus.ASSIGNED_QA]: { label: "QA Assigned", color: "bg-indigo-500" },
  [JobStatus.QA_IN_PROGRESS]: {
    label: "QA in Progress",
    color: "bg-orange-500",
  },
  [JobStatus.QA_REJECTED]: { label: "Rejected", color: "bg-red-500" },
  [JobStatus.QA_ACCEPTED]: { label: "Accepted", color: "bg-green-500" },
  [JobStatus.DELIVERED]: { label: "Delivered", color: "bg-emerald-500" },
  [JobStatus.DISCARDED]: { label: "Discarded", color: "bg-slate-500" },
};

interface DatasetStatusCardsProps {
  statusSummary: Record<string, number>;
  activeStatus?: string;
  onStatusClick: (status: string) => void;
}

export function DatasetStatusCards({
  statusSummary,
  activeStatus,
  onStatusClick,
}: DatasetStatusCardsProps) {
  const statuses = Object.keys(STATUS_DISPLAY);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5" data-testid="dataset-status-cards">
      {statuses.map((statusKey) => {
        const count = statusSummary[statusKey] ?? 0;
        const display = STATUS_DISPLAY[statusKey];
        const isActive = activeStatus === statusKey;

        return (
          <Card
            key={statusKey}
            className={`cursor-pointer transition-shadow hover:shadow-md ${
              isActive ? "ring-2 ring-primary" : ""
            }`}
            onClick={() => onStatusClick(isActive ? "" : statusKey)}
          >
            <CardContent className="px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full ${display.color}`}
                />
                <span className="text-lg font-bold">{count}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground truncate">
                {display.label}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
