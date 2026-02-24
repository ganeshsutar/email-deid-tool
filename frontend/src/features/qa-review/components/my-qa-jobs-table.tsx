import { Link, useNavigate } from "@tanstack/react-router";
import { differenceInDays } from "date-fns";
import { ClipboardCheck, History } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { JobStatus } from "@/types/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { MyQAJob } from "../api/qa-review-mapper";

interface MyQAJobsTableProps {
  jobs: MyQAJob[];
}

const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  [JobStatus.ASSIGNED_QA]: "outline",
  [JobStatus.QA_IN_PROGRESS]: "secondary",
  [JobStatus.DELIVERED]: "default",
  [JobStatus.QA_REJECTED]: "destructive",
  [JobStatus.DISCARDED]: "outline",
};

const statusLabelMap: Record<string, string> = {
  [JobStatus.ASSIGNED_QA]: "QA Assigned",
  [JobStatus.QA_IN_PROGRESS]: "In Review",
  [JobStatus.DELIVERED]: "Accepted",
  [JobStatus.QA_REJECTED]: "Rejected",
  [JobStatus.DISCARDED]: "Discarded",
};

export function MyQAJobsTable({ jobs }: MyQAJobsTableProps) {
  const navigate = useNavigate();

  function getAction(job: MyQAJob) {
    switch (job.status) {
      case JobStatus.ASSIGNED_QA:
        return "Start QA";
      case JobStatus.QA_IN_PROGRESS:
        return "Continue";
      default:
        return "View";
    }
  }

  return (
    <Table data-testid="qa-jobs-table">
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          <TableHead>Dataset</TableHead>
          <TableHead>Annotator</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Annotations</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="w-36">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="p-0">
              <EmptyState
                icon={ClipboardCheck}
                title="No QA jobs"
                description="Check back soon for new reviews."
              />
            </TableCell>
          </TableRow>
        ) : (
          jobs.map((job) => (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{job.fileName}</TableCell>
              <TableCell>{job.datasetName}</TableCell>
              <TableCell className="text-sm" data-testid="annotator-info">
                {job.annotatorName ?? "-"}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariantMap[job.status] ?? "outline"}>
                  {statusLabelMap[job.status] ?? job.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">{job.annotationCount}</TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(job.updatedAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-sm tabular-nums">
                {(() => {
                  const days = differenceInDays(new Date(), new Date(job.updatedAt));
                  return (
                    <span className={days > 3 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
                      {days}d
                    </span>
                  );
                })()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant={
                      job.status === JobStatus.ASSIGNED_QA ||
                      job.status === JobStatus.QA_IN_PROGRESS
                        ? "default"
                        : "outline"
                    }
                    onClick={() =>
                      navigate({
                        to: "/qa/jobs/$jobId/review",
                        params: { jobId: job.id },
                      })
                    }
                    data-testid="job-review-button"
                  >
                    {getAction(job)}
                  </Button>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" asChild>
                          <Link
                            to="/qa/jobs/$jobId/history"
                            params={{ jobId: job.id }}
                          >
                            <History className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Version History</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
        {jobs
          .filter((j) => j.status === JobStatus.DISCARDED && j.discardReason)
          .map((job) => (
            <TableRow key={`${job.id}-discard`} className="bg-slate-50/50 dark:bg-slate-950/10">
              <TableCell colSpan={8}>
                <div className="border-l-2 border-slate-400 pl-3 py-1">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-slate-600">Discard Reason:</span>{" "}
                    {job.discardReason}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ))}
      </TableBody>
    </Table>
  );
}
