import { Eye } from "lucide-react";
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
import { DataTablePagination } from "@/components/data-table-pagination";
import type { DeliveredJob } from "../api/export-mapper";

interface DeliveredJobsTableProps {
  jobs: DeliveredJob[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  onPreview: (jobId: string) => void;
  showDatasetColumn?: boolean;
}

export function DeliveredJobsTable({
  jobs,
  selectedIds,
  onSelectionChange,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onPreview,
  showDatasetColumn = false,
}: DeliveredJobsTableProps) {
  const visibleJobs = jobs.slice((page - 1) * pageSize, page * pageSize);

  const allVisibleSelected =
    visibleJobs.length > 0 && visibleJobs.every((j) => selectedIds.has(j.id));
  const someVisibleSelected =
    visibleJobs.some((j) => selectedIds.has(j.id)) && !allVisibleSelected;

  function toggleAll() {
    const next = new Set(selectedIds);
    if (allVisibleSelected) {
      for (const j of visibleJobs) {
        next.delete(j.id);
      }
    } else {
      for (const j of visibleJobs) {
        next.add(j.id);
      }
    }
    onSelectionChange(next);
  }

  function toggleOne(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  }

  return (
    <div data-testid="delivered-jobs-table">
      {selectedIds.size > 0 && (
        <p className="text-sm text-muted-foreground mb-2" data-testid="export-selected-count">
          {selectedIds.size} of {jobs.length} job(s) selected
        </p>
      )}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allVisibleSelected ? true : someVisibleSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                  data-testid="select-all-checkbox"
                />
              </TableHead>
              <TableHead>File Name</TableHead>
              {showDatasetColumn && <TableHead>Dataset</TableHead>}
              <TableHead>Annotator</TableHead>
              <TableHead>QA Reviewer</TableHead>
              <TableHead className="text-right">Annotations</TableHead>
              <TableHead>Delivered Date</TableHead>
              <TableHead className="w-[60px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showDatasetColumn ? 8 : 7} className="text-center text-muted-foreground h-24" data-testid="delivered-jobs-empty">
                  No delivered jobs found
                </TableCell>
              </TableRow>
            ) : (
              visibleJobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(job.id)}
                      onCheckedChange={() => toggleOne(job.id)}
                      data-testid="job-export-checkbox"
                    />
                  </TableCell>
                  <TableCell className="font-medium">{job.fileName}</TableCell>
                  {showDatasetColumn && (
                    <TableCell className="text-muted-foreground">{job.datasetName ?? "—"}</TableCell>
                  )}
                  <TableCell>{job.annotator?.name ?? "—"}</TableCell>
                  <TableCell>{job.qaReviewer?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {job.annotationCount}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(job.deliveredDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onPreview(job.id)}
                      data-testid="job-preview-button"
                    >
                      <Eye className="h-4 w-4" />
                      <span className="sr-only">Preview</span>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {jobs.length > 0 && (
        <div className="mt-2">
          <DataTablePagination
            page={page}
            pageSize={pageSize}
            totalCount={jobs.length}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
}
