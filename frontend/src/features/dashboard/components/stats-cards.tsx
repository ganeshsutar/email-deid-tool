import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Database,
  Briefcase,
  Clock,
  PlayCircle,
  CheckCircle2,
  ShieldCheck,
  Ban,
} from "lucide-react";
import {
  Card,
  CardContent,
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
  linkTo,
  linkLabel,
}: {
  title: string;
  value: number;
  icon: ReactNode;
  linkTo?: string;
  linkLabel?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl tabular-nums">{value}</CardTitle>
        <CardAction>{icon}</CardAction>
      </CardHeader>
      {linkTo && linkLabel && (
        <CardContent>
          <Link
            to={linkTo}
            className="text-xs text-primary hover:underline"
          >
            {linkLabel}
          </Link>
        </CardContent>
      )}
    </Card>
  );
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:shadow-xs">
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
        title="Pending Assignment"
        value={stats.pendingAssignment}
        icon={<Clock className="h-4 w-4 text-muted-foreground" />}
        linkTo="/admin/job-assignment"
        linkLabel="Assign jobs"
      />
      <StatCard
        title="In Progress"
        value={stats.inProgress}
        icon={<PlayCircle className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Awaiting QA"
        value={stats.awaitingQa}
        icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Delivered"
        value={stats.delivered}
        icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
      />
      <StatCard
        title="Discarded"
        value={stats.discarded}
        icon={<Ban className="h-4 w-4 text-muted-foreground" />}
      />
    </div>
  );
}
