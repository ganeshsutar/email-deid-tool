import { createFileRoute } from "@tanstack/react-router";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardStats } from "@/features/dashboard/api/get-dashboard-stats";
import { useRecentDatasets } from "@/features/dashboard/api/get-recent-datasets";
import { useAnnotatorPerformance } from "@/features/dashboard/api/get-annotator-performance";
import { useQAPerformance } from "@/features/dashboard/api/get-qa-performance";
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
  const { data: recentDatasets } = useRecentDatasets();
  const { data: annotatorPerf } = useAnnotatorPerformance();
  const { data: qaPerf } = useQAPerformance();

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
        <QuickActions stats={stats} />
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
        {recentDatasets && <RecentDatasetsTable datasets={recentDatasets} />}
      </div>

      {/* Performance Tables */}
      <div className="grid gap-4 lg:grid-cols-2">
        {annotatorPerf && <AnnotatorPerformanceTable data={annotatorPerf} />}
        {qaPerf && <QAPerformanceTable data={qaPerf} />}
      </div>
    </div>
  );
}
