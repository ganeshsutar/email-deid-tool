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
}: {
  title: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <Card>
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
      <div className="grid gap-4 grid-cols-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:shadow-xs">
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
          value={stats.delivered}
          icon={<PackageCheck className="h-4 w-4 text-muted-foreground" />}
        />
        <StatCard
          title="Discarded"
          value={stats.discarded}
          icon={<Ban className="h-4 w-4 text-muted-foreground" />}
        />
      </div>

      {/* Row 2: Annotation (3) + QA (3) */}
      <div className="grid gap-4 grid-cols-6 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:shadow-xs">
        {/* Annotation group */}
        <div className="col-span-3 space-y-2">
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
        <div className="col-span-3 space-y-2">
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
