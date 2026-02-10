import { Link } from "@tanstack/react-router";
import { Upload, UserPlus, ShieldCheck, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { DashboardStats } from "@/features/dashboard/api/dashboard-mapper";

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

interface QuickActionsProps {
  stats?: DashboardStats;
}

export function QuickActions({ stats }: QuickActionsProps) {
  const pending = stats?.pendingAssignment ?? 0;
  const awaiting = stats?.awaitingQa ?? 0;

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/datasets">
          <Upload className="h-4 w-4 mr-1.5" />
          Upload Dataset
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/job-assignment">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Assign Annotation Jobs
          {pending > 0 && <Badge className="ml-1.5 h-5 px-1.5 text-[11px]">{formatCount(pending)}</Badge>}
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/job-assignment">
          <ShieldCheck className="h-4 w-4 mr-1.5" />
          Assign QA Jobs
          {awaiting > 0 && <Badge className="ml-1.5 h-5 px-1.5 text-[11px]">{formatCount(awaiting)}</Badge>}
        </Link>
      </Button>
      <Button variant="outline" size="sm" asChild>
        <Link to="/admin/export">
          <Download className="h-4 w-4 mr-1.5" />
          Export Delivered Jobs
        </Link>
      </Button>
    </div>
  );
}
