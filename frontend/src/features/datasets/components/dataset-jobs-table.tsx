import { Download, Eye, FileText, History, RotateCcw, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { JobStatus } from "@/types/enums";
import type { Job } from "@/types/models";
import { StatusBadge } from "./status-badge";

const RESETTABLE_STATUSES: string[] = [
  JobStatus.DELIVERED,
  JobStatus.QA_ACCEPTED,
  JobStatus.QA_REJECTED,
  JobStatus.DISCARDED,
];

interface DatasetJobsTableProps {
  jobs: Job[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onJobClick?: (jobId: string) => void;
  onHistoryClick?: (jobId: string) => void;
  onDownloadClick?: (jobId: string, fileName: string) => void;
  onDeleteClick?: (jobId: string, fileName: string) => void;
  onResetClick?: (jobId: string, fileName: string, status: string) => void;
}

export function DatasetJobsTable({
  jobs,
  selectedIds,
  onSelectionChange,
  onJobClick,
  onHistoryClick,
  onDownloadClick,
  onDeleteClick,
  onResetClick,
}: DatasetJobsTableProps) {
  const allSelected = jobs.length > 0 && jobs.every((j) => selectedIds.has(j.id));

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const newSet = new Set(selectedIds);
      for (const job of jobs) newSet.add(job.id);
      onSelectionChange(newSet);
    } else {
      const newSet = new Set(selectedIds);
      for (const job of jobs) newSet.delete(job.id);
      onSelectionChange(newSet);
    }
  }

  function handleSelectOne(id: string, checked: boolean) {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    onSelectionChange(newSet);
  }

  return (
    <Table data-testid="dataset-jobs-table">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[40px]">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
            />
          </TableHead>
          <TableHead>File Name</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Annotator</TableHead>
          <TableHead>QA</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-36" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="p-0">
              <EmptyState icon={FileText} title="No jobs found" />
            </TableCell>
          </TableRow>
        ) : (
          jobs.map((job) => (
            <TableRow
              key={job.id}
              className={onJobClick ? "cursor-pointer" : undefined}
              onClick={() => onJobClick?.(job.id)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={selectedIds.has(job.id)}
                  onCheckedChange={(checked) =>
                    handleSelectOne(job.id, !!checked)
                  }
                />
              </TableCell>
              <TableCell className="font-medium">{job.fileName}</TableCell>
              <TableCell>
                <StatusBadge status={job.status} />
              </TableCell>
              <TableCell>
                {job.assignedAnnotator?.name ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {job.assignedQa?.name ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell>
                {new Date(job.updatedAt).toLocaleDateString()}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onJobClick?.(job.id)}
                          data-testid="job-view-button"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View Email</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onHistoryClick?.(job.id)}
                          data-testid="job-history-button"
                        >
                          <History className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Version History</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDownloadClick?.(job.id, job.fileName)}
                          data-testid="job-download-button"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Download .eml</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  {RESETTABLE_STATUSES.includes(job.status) && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onResetClick?.(job.id, job.fileName, job.status)}
                            data-testid="job-reset-button"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Reset to Uploaded</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onDeleteClick?.(job.id, job.fileName)}
                          data-testid="job-delete-button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete Job</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
