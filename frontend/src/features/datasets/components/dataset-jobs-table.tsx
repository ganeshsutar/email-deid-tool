import { Download, Eye, FileText, History, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatRelativeDate, formatAbsoluteDate } from "@/lib/format-date";
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
          <TableHead className="hidden md:table-cell">Annotator</TableHead>
          <TableHead className="hidden md:table-cell">QA</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="w-20" />
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
              <TableCell className="hidden md:table-cell">
                {job.assignedAnnotator?.name ?? (
                  <span className="text-muted-foreground">&mdash;</span>
                )}
              </TableCell>
              <TableCell className="hidden md:table-cell">
                {job.assignedQa?.name ?? (
                  <span className="text-muted-foreground">&mdash;</span>
                )}
              </TableCell>
              <TableCell>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">{formatRelativeDate(job.updatedAt)}</span>
                    </TooltipTrigger>
                    <TooltipContent>{formatAbsoluteDate(job.updatedAt)}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onJobClick?.(job.id)}
                    aria-label="View email"
                    data-testid="job-view-button"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="More actions"
                        data-testid="job-actions-menu"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onHistoryClick?.(job.id)}>
                        <History className="mr-2 h-4 w-4" />
                        Version History
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onDownloadClick?.(job.id, job.fileName)}>
                        <Download className="mr-2 h-4 w-4" />
                        Download .eml
                      </DropdownMenuItem>
                      {RESETTABLE_STATUSES.includes(job.status) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => onResetClick?.(job.id, job.fileName, job.status)}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Reset to Uploaded
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => onDeleteClick?.(job.id, job.fileName)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Job
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
