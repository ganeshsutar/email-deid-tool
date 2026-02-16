import { type ReactNode, useMemo } from "react";
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
import { useJobStatusCounts } from "@/features/dashboard/api/get-job-status-counts";
import { useRecentDatasets } from "@/features/dashboard/api/get-recent-datasets";
import { StatsCards } from "@/features/dashboard/components/stats-cards";
import { JobStatusChart } from "@/features/dashboard/components/job-status-chart";
import { RecentDatasetsTable } from "@/features/dashboard/components/recent-datasets-table";
import { AnnotatorPerformanceTable } from "@/features/dashboard/components/annotator-performance-table";
import { QAPerformanceTable } from "@/features/dashboard/components/qa-performance-table";
import { QuickActions } from "@/features/dashboard/components/quick-actions";
import type { DashboardStats } from "@/features/dashboard/api/dashboard-mapper";

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

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Uploaded",
  ASSIGNED_ANNOTATOR: "Assigned",
  ANNOTATION_IN_PROGRESS: "Annotating",
  SUBMITTED_FOR_QA: "Submitted",
  ASSIGNED_QA: "QA Assigned",
  QA_IN_PROGRESS: "In QA",
  QA_REJECTED: "Rejected",
  DELIVERED: "Delivered",
  DISCARDED: "Discarded",
};

const STATUS_ORDER = [
  "UPLOADED",
  "ASSIGNED_ANNOTATOR",
  "ANNOTATION_IN_PROGRESS",
  "SUBMITTED_FOR_QA",
  "ASSIGNED_QA",
  "QA_IN_PROGRESS",
  "QA_REJECTED",
  "DELIVERED",
  "DISCARDED",
] as const;

function N({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`font-mono tabular-nums ${className ?? ""}`}>
      {children}
    </span>
  );
}

function statusTerm(counts: Record<string, number>, key: string): ReactNode {
  return (
    <>
      {STATUS_LABELS[key] ?? key}(<N>{counts[key] ?? 0}</N>)
    </>
  );
}

function sumFormula(
  counts: Record<string, number>,
  keys: string[],
  total: number,
): ReactNode {
  return (
    <span className="leading-relaxed">
      {keys.map((key, i) => (
        <span key={key}>
          {i > 0 && " + "}
          {statusTerm(counts, key)}
        </span>
      ))}{" "}
      = <N className="font-semibold">{total}</N>
    </span>
  );
}

interface StatsInfoSection {
  title: string;
  rows: { card: string; description: ReactNode }[];
  note?: string;
}

function buildStatsInfoSections(
  counts: Record<string, number>,
  stats: DashboardStats,
): StatsInfoSection[] {
  const c = (key: string) => counts[key] ?? 0;

  const annCompletedKeys = [
    "SUBMITTED_FOR_QA",
    "ASSIGNED_QA",
    "QA_IN_PROGRESS",
    "QA_REJECTED",
    "DELIVERED",
  ];
  const qaCompletedKeys = ["QA_REJECTED", "DELIVERED"];
  const allKeys = STATUS_ORDER as unknown as string[];
  const allSum = allKeys.reduce((s, k) => s + c(k), 0);

  return [
    {
      title: "Overview",
      rows: [
        {
          card: "Total Datasets",
          description: (
            <>
              Count of all datasets = <N className="font-semibold">{stats.totalDatasets}</N>
            </>
          ),
        },
        {
          card: "Total Jobs",
          description: sumFormula(counts, allKeys, allSum),
        },
        {
          card: "Delivered",
          description: (
            <>
              {STATUS_LABELS.DELIVERED} = <N className="font-semibold">{c("DELIVERED")}</N>
            </>
          ),
        },
        {
          card: "Discarded",
          description: (
            <>
              {STATUS_LABELS.DISCARDED} = <N className="font-semibold">{c("DISCARDED")}</N>
            </>
          ),
        },
      ],
    },
    {
      title: "Annotation",
      rows: [
        {
          card: "Assigned",
          description: (
            <>
              Has annotator assigned, excl. discarded ={" "}
              <N className="font-semibold">{stats.annAssigned}</N>
            </>
          ),
        },
        {
          card: "In Progress",
          description: (
            <>
              {STATUS_LABELS.ANNOTATION_IN_PROGRESS} ={" "}
              <N className="font-semibold">{c("ANNOTATION_IN_PROGRESS")}</N>
            </>
          ),
        },
        {
          card: "Completed",
          description: sumFormula(counts, annCompletedKeys, stats.annCompleted),
        },
      ],
      note: "Annotation Completed includes Rejected because the annotator did complete their annotation — the rejection happened during QA review.",
    },
    {
      title: "QA Review",
      rows: [
        {
          card: "Assigned",
          description: (
            <>
              Has QA reviewer assigned, excl. discarded ={" "}
              <N className="font-semibold">{stats.qaAssigned}</N>
            </>
          ),
        },
        {
          card: "In Progress",
          description: (
            <>
              {STATUS_LABELS.QA_IN_PROGRESS} ={" "}
              <N className="font-semibold">{c("QA_IN_PROGRESS")}</N>
            </>
          ),
        },
        {
          card: "Completed",
          description: sumFormula(counts, qaCompletedKeys, stats.qaCompleted),
        },
      ],
    },
  ];
}

function StatsInfoDialog() {
  const { data: stats } = useDashboardStats();
  const { data: statusCounts } = useJobStatusCounts();

  const counts = statusCounts ?? {};

  const sections = useMemo(
    () =>
      stats
        ? buildStatsInfoSections(counts, stats)
        : null,
    [counts, stats],
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Info className="h-4 w-4 mr-1.5" />
          Stats Info
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-6xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stats Card Reference</DialogTitle>
          <DialogDescription>
            What each dashboard stat card counts and how values are computed from
            job status distribution.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          {sections ? (
            <div className="grid grid-cols-3 gap-4">
              {sections.map((section) => (
                <div key={section.title} className="space-y-2">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  <div className="rounded-md border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">
                            Card
                          </th>
                          <th className="px-3 py-2 text-left font-medium">
                            Formula
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.rows.map((row) => (
                          <tr
                            key={row.card}
                            className="border-b last:border-0"
                          >
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
                  {section.note && (
                    <p className="text-xs text-muted-foreground italic">
                      {section.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-32 w-full" />
                </div>
              ))}
            </div>
          )}

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

          {/* Job Status Distribution */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Job Status Distribution</h3>
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    {STATUS_ORDER.map((key) => (
                      <th
                        key={key}
                        className="px-3 py-2 text-center font-medium whitespace-nowrap"
                      >
                        {STATUS_LABELS[key]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {STATUS_ORDER.map((key) => (
                      <td
                        key={key}
                        className="px-3 py-2 text-center font-mono tabular-nums"
                      >
                        {counts[key] ?? 0}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
