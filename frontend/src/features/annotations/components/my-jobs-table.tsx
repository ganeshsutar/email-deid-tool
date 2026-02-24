import { Link, useNavigate } from "@tanstack/react-router";
import { differenceInDays } from "date-fns";
import { ClipboardList, History } from "lucide-react";
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
import type { MyAnnotationJob } from "../api/annotation-mapper";

interface MyJobsTableProps {
  jobs: MyAnnotationJob[];
}

const statusVariantMap: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  [JobStatus.ASSIGNED_ANNOTATOR]: "outline",
  [JobStatus.ANNOTATION_IN_PROGRESS]: "secondary",
  [JobStatus.SUBMITTED_FOR_QA]: "default",
  [JobStatus.ASSIGNED_QA]: "secondary",
  [JobStatus.QA_IN_PROGRESS]: "secondary",
  [JobStatus.QA_REJECTED]: "destructive",
  [JobStatus.DELIVERED]: "default",
  [JobStatus.DISCARDED]: "outline",
};

const statusLabelMap: Record<string, string> = {
  [JobStatus.ASSIGNED_ANNOTATOR]: "Assigned",
  [JobStatus.ANNOTATION_IN_PROGRESS]: "In Progress",
  [JobStatus.SUBMITTED_FOR_QA]: "Submitted",
  [JobStatus.ASSIGNED_QA]: "In QA",
  [JobStatus.QA_IN_PROGRESS]: "In QA",
  [JobStatus.QA_REJECTED]: "Rejected",
  [JobStatus.QA_ACCEPTED]: "Accepted",
  [JobStatus.DELIVERED]: "Delivered",
  [JobStatus.DISCARDED]: "Discarded",
};

export function MyJobsTable({ jobs }: MyJobsTableProps) {
  const navigate = useNavigate();

  function getAction(job: MyAnnotationJob) {
    switch (job.status) {
      case JobStatus.ASSIGNED_ANNOTATOR:
        return { label: "Start Annotation", navigable: true };
      case JobStatus.ANNOTATION_IN_PROGRESS:
        return { label: "Continue", navigable: true };
      case JobStatus.QA_REJECTED:
        return { label: "Rework", navigable: true };
      default:
        return { label: "View", navigable: false };
    }
  }

  return (
    <Table data-testid="my-jobs-table">
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          <TableHead>Dataset</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Annotations</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>Age</TableHead>
          <TableHead className="w-40">Action</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="p-0">
              <EmptyState
                icon={ClipboardList}
                title="No jobs assigned"
                description="Check back soon for new assignments."
              />
            </TableCell>
          </TableRow>
        ) : (
          jobs.map((job) => {
            const action = getAction(job);
            return (
              <TableRow key={job.id}>
                <TableCell className="font-medium">{job.fileName}</TableCell>
                <TableCell>{job.datasetName}</TableCell>
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
                      variant={action.navigable ? "default" : "outline"}
                      data-testid="job-annotate-button"
                      onClick={() => {
                        navigate({
                          to: "/annotator/jobs/$jobId/annotate",
                          params: { jobId: job.id },
                        });
                      }}
                    >
                      {action.label}
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" asChild>
                            <Link
                              to="/annotator/jobs/$jobId/history"
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
            );
          })
        )}
        {jobs
          .filter((j) => j.status === JobStatus.QA_REJECTED && j.reworkInfo)
          .map((job) => (
            <TableRow key={`${job.id}-rework`} className="bg-red-50/50 dark:bg-red-950/10">
              <TableCell colSpan={7}>
                <div className="border-l-2 border-red-400 pl-3 py-1">
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium text-red-600">QA Comments:</span>{" "}
                    {job.reworkInfo!.comments}
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ))}
        {jobs
          .filter((j) => j.status === JobStatus.DISCARDED && j.discardReason)
          .map((job) => (
            <TableRow key={`${job.id}-discard`} className="bg-slate-50/50 dark:bg-slate-950/10">
              <TableCell colSpan={7}>
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
