import type { ReactNode } from "react";
import {
  Database,
  Briefcase,
  UserCheck,
  PlayCircle,
  CheckCircle2,
  ShieldCheck,
  PackageCheck,
  Ban,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import type { DashboardStats } from "../api/dashboard-mapper";

interface StatsCardsProps {
  stats: DashboardStats;
}

function StatCard({
  title,
  value,
  icon,
  tint,
}: {
  title: string;
  value: ReactNode;
  icon: ReactNode;
  tint?: "green" | "red";
}) {
  const tintClass =
    tint === "green"
      ? "from-green-500/5"
      : tint === "red"
        ? "from-red-500/5"
        : "from-primary/5";
  return (
    <Card data-slot="card" className={`bg-gradient-to-t ${tintClass} shadow-xs`}>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <CardAction>{icon}</CardAction>
      </CardHeader>
    </Card>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="space-y-4">
      {/* Row 1: Overview */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        <StatCard
          title="Total Datasets"
          value={stats.totalDatasets}
          icon={<Database className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Total Jobs"
          value={stats.totalJobs}
          icon={<Briefcase className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Delivered"
          value={stats.totalJobs > 0 ? `${stats.delivered} (${Math.round((stats.delivered / stats.totalJobs) * 100)}%)` : stats.delivered}
          icon={<PackageCheck className="h-4 w-4 text-muted-foreground" />}
          tint="green"
        />
        <StatCard
          title="Discarded"
          value={stats.totalJobs > 0 ? `${stats.discarded} (${Math.round((stats.discarded / stats.totalJobs) * 100)}%)` : stats.discarded}
          icon={<Ban className="h-4 w-4 text-muted-foreground" />}
          tint="red"
        />
      </div>

      {/* Row 2: Annotation (3) + QA (3) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
        {/* Annotation group */}
        <div className="sm:col-span-1 lg:col-span-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Annotation
          </p>
          <div className="grid gap-4 grid-cols-3">
            <StatCard
              title="Assigned"
              value={stats.annAssigned}
              icon={<UserCheck className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="In Progress"
              value={stats.annInProgress}
              icon={<PlayCircle className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Completed"
              value={stats.annCompleted}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </div>

        {/* QA group */}
        <div className="sm:col-span-1 lg:col-span-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            QA Review
          </p>
          <div className="grid gap-4 grid-cols-3">
            <StatCard
              title="Assigned"
              value={stats.qaAssigned}
              icon={<UserCheck className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="In Progress"
              value={stats.qaInProgress}
              icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
            />
            <StatCard
              title="Completed"
              value={stats.qaCompleted}
              icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
