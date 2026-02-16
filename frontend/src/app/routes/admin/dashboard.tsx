import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDashboardStats } from "@/features/dashboard/api/get-dashboard-stats";
import { useRecentDatasets } from "@/features/dashboard/api/get-recent-datasets";
import { StatsCards } from "@/features/dashboard/components/stats-cards";
import { JobStatusChart } from "@/features/dashboard/components/job-status-chart";
import { RecentDatasetsTable } from "@/features/dashboard/components/recent-datasets-table";
import { AnnotatorPerformanceTable } from "@/features/dashboard/components/annotator-performance-table";
import { QAPerformanceTable } from "@/features/dashboard/components/qa-performance-table";
import { QuickActions } from "@/features/dashboard/components/quick-actions";

export const Route = createFileRoute("/admin/dashboard")({
  component: AdminDashboardPage,
});

function AdminDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentDatasets, isLoading: datasetsLoading } =
    useRecentDatasets();

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Overview of annotation activity and platform metrics.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatsInfoDialog />
          <QuickActions />
        </div>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="rounded-lg border p-4 space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      ) : stats ? (
        <StatsCards stats={stats} />
      ) : null}

      {/* Job Status Chart + Recent Datasets side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <JobStatusChart />
        {datasetsLoading ? (
          <Card>
            <CardHeader>
              <CardTitle>Recent Datasets</CardTitle>
              <CardDescription>
                5 most recently uploaded datasets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <TableSkeleton rows={5} columns={6} />
            </CardContent>
          </Card>
        ) : recentDatasets ? (
          <RecentDatasetsTable datasets={recentDatasets} />
        ) : null}
      </div>

      {/* Performance Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        <AnnotatorPerformanceTable />
        <QAPerformanceTable />
      </div>
    </div>
  );
}

const STATS_INFO_SECTIONS = [
  {
    title: "Overview",
    rows: [
      { card: "Total Datasets", description: "Total number of datasets uploaded" },
      { card: "Total Jobs", description: "Total number of jobs across all datasets" },
      { card: "Delivered", description: "Jobs with status DELIVERED" },
      { card: "Discarded", description: "Jobs with status DISCARDED" },
    ],
  },
  {
    title: "Annotation",
    rows: [
      { card: "Assigned", description: "Jobs that have an annotator assigned (any status)" },
      { card: "In Progress", description: "Jobs with status ANNOTATION_IN_PROGRESS" },
      {
        card: "Completed",
        description:
          "Jobs with an annotator assigned and status in: SUBMITTED_FOR_QA, ASSIGNED_QA, QA_IN_PROGRESS, QA_ACCEPTED, QA_REJECTED, DELIVERED",
      },
    ],
    note: "Annotation Completed includes QA_REJECTED because the annotator did complete their annotation — the rejection happened during QA review.",
  },
  {
    title: "QA Review",
    rows: [
      { card: "Assigned", description: "Jobs that have a QA reviewer assigned (any status)" },
      { card: "In Progress", description: "Jobs with status QA_IN_PROGRESS" },
      {
        card: "Completed",
        description:
          "Jobs with a QA reviewer assigned and status in: QA_ACCEPTED, QA_REJECTED, DELIVERED",
      },
    ],
  },
] as const;

function StatsInfoDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="h-4 w-4 mr-1.5" />
          Stats Info
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stats Card Reference</DialogTitle>
          <DialogDescription>
            What each dashboard stat card counts and which job statuses it
            includes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6 mt-2">
          {STATS_INFO_SECTIONS.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-sm font-semibold">{section.title}</h3>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Card</th>
                      <th className="px-3 py-2 text-left font-medium">
                        Description
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {section.rows.map((row) => (
                      <tr key={row.card} className="border-b last:border-0">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">
                          {row.card}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {row.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {"note" in section && section.note && (
                <p className="text-xs text-muted-foreground italic">
                  {section.note}
                </p>
              )}
            </div>
          ))}
          <div className="space-y-1 text-xs text-muted-foreground">
            <h3 className="text-sm font-semibold text-foreground">
              Relationships
            </h3>
            <ul className="list-disc list-inside space-y-1">
              <li>
                QA Assigned &ge; QA In Progress + QA Completed
              </li>
              <li>
                Annotation Completed &ge; QA Assigned
              </li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
