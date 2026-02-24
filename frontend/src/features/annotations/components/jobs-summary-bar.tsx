import { Card, CardContent } from "@/components/ui/card";
import { JobStatus } from "@/types/enums";

interface JobsSummaryBarProps {
  statusCounts: Record<string, number>;
}

export function JobsSummaryBar({ statusCounts }: JobsSummaryBarProps) {
  const total = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);

  const items = [
    { label: "Assigned", value: statusCounts[JobStatus.ASSIGNED_ANNOTATOR] ?? 0, color: "text-blue-600" },
    { label: "In Progress", value: statusCounts[JobStatus.ANNOTATION_IN_PROGRESS] ?? 0, color: "text-yellow-600" },
    { label: "Submitted", value: statusCounts[JobStatus.SUBMITTED_FOR_QA] ?? 0, color: "text-green-600" },
    { label: "In QA", value: (statusCounts[JobStatus.ASSIGNED_QA] ?? 0) + (statusCounts[JobStatus.QA_IN_PROGRESS] ?? 0), color: "text-purple-600" },
    { label: "Rejected", value: statusCounts[JobStatus.QA_REJECTED] ?? 0, color: "text-red-600" },
    { label: "Total", value: total, color: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-3" data-testid="jobs-summary-bar">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-3">
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className={`text-xl font-bold ${item.color}`}>{item.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
