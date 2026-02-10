import { Card, CardContent } from "@/components/ui/card";
import { JobStatus } from "@/types/enums";

interface QAJobsSummaryBarProps {
  statusCounts: Record<string, number>;
}

export function QAJobsSummaryBar({ statusCounts }: QAJobsSummaryBarProps) {
  const total = Object.values(statusCounts).reduce((sum, c) => sum + c, 0);

  const items = [
    { label: "QA Assigned", value: statusCounts[JobStatus.ASSIGNED_QA] ?? 0, color: "text-blue-600" },
    { label: "In Review", value: statusCounts[JobStatus.QA_IN_PROGRESS] ?? 0, color: "text-yellow-600" },
    { label: "Accepted", value: statusCounts[JobStatus.DELIVERED] ?? 0, color: "text-green-600" },
    { label: "Rejected", value: statusCounts[JobStatus.QA_REJECTED] ?? 0, color: "text-red-600" },
    { label: "Total", value: total, color: "text-foreground" },
  ];

  return (
    <div className="grid grid-cols-5 gap-3" data-testid="qa-summary-bar">
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
