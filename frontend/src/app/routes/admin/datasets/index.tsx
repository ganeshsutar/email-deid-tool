import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Database, Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTablePagination } from "@/components/data-table-pagination";
import { EmptyState } from "@/components/empty-state";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Checkbox } from "@/components/ui/checkbox";
import { downloadDatasetCsv } from "@/features/datasets/api/download-dataset-csv";
import { useDatasets } from "@/features/datasets/api/get-datasets";
import { StatusBadge } from "@/features/datasets/components/status-badge";
import { DatasetUploadDialog } from "@/features/datasets/components/dataset-upload-dialog";
import { DatasetDeleteConfirmDialog } from "@/features/datasets/components/dataset-delete-confirm-dialog";
import { JobStatus } from "@/types/enums";
import { formatRelativeDate, formatAbsoluteDate } from "@/lib/format-date";
import type { DatasetSummary } from "@/features/datasets/api/dataset-mapper";

const STATUS_COLORS: Record<string, string> = {
  [JobStatus.UPLOADED]: "bg-gray-500",
  [JobStatus.ASSIGNED_ANNOTATOR]: "bg-blue-500",
  [JobStatus.ANNOTATION_IN_PROGRESS]: "bg-yellow-500",
  [JobStatus.SUBMITTED_FOR_QA]: "bg-purple-500",
  [JobStatus.ASSIGNED_QA]: "bg-indigo-500",
  [JobStatus.QA_IN_PROGRESS]: "bg-orange-500",
  [JobStatus.QA_REJECTED]: "bg-red-500",
  [JobStatus.QA_ACCEPTED]: "bg-green-500",
  [JobStatus.DELIVERED]: "bg-emerald-500",
  [JobStatus.DISCARDED]: "bg-slate-500",
};

const STATUS_LABELS: Record<string, string> = {
  [JobStatus.UPLOADED]: "Uploaded",
  [JobStatus.ASSIGNED_ANNOTATOR]: "Assigned",
  [JobStatus.ANNOTATION_IN_PROGRESS]: "Annotating",
  [JobStatus.SUBMITTED_FOR_QA]: "Submitted for QA",
  [JobStatus.ASSIGNED_QA]: "QA Assigned",
  [JobStatus.QA_IN_PROGRESS]: "QA in Progress",
  [JobStatus.QA_REJECTED]: "Rejected",
  [JobStatus.QA_ACCEPTED]: "Accepted",
  [JobStatus.DELIVERED]: "Delivered",
  [JobStatus.DISCARDED]: "Discarded",
};

export const Route = createFileRoute("/admin/datasets/")({
  component: DatasetsPage,
});

function StackedProgressBar({ statusSummary, fileCount }: { statusSummary: Record<string, number>; fileCount: number }) {
  const total = fileCount || 1;
  const segments: Array<{ status: string; count: number; pct: number; color: string }> = [];

  for (const [status, color] of Object.entries(STATUS_COLORS)) {
    const count = statusSummary[status] ?? 0;
    if (count > 0) {
      segments.push({ status, count, pct: (count / total) * 100, color });
    }
  }

  const tooltipLines = segments.map(
    (s) => `${STATUS_LABELS[s.status] ?? s.status}: ${s.count}`,
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {segments.map((s) => (
              <div
                key={s.status}
                className={`h-full ${s.color}`}
                style={{ width: `${s.pct}%` }}
              />
            ))}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="text-xs space-y-0.5">
            {tooltipLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function DatasetsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DatasetSummary | null>(null);
  const [bulkDeleteTargets, setBulkDeleteTargets] = useState<
    Array<{ id: string; name: string; fileCount: number }> | null
  >(null);

  const { data, isLoading } = useDatasets({ page, pageSize, search, status: statusFilter || undefined });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const datasets = data?.results ?? [];

  const allSelected =
    datasets.length > 0 && datasets.every((d) => selectedIds.has(d.id));

  function handleSelectAll(checked: boolean) {
    if (checked) {
      setSelectedIds(new Set(datasets.map((d) => d.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleSelectOne(id: string, checked: boolean) {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  }

  const handleRowClick = useCallback(
    (id: string) => {
      navigate({ to: "/admin/datasets/$id", params: { id } });
    },
    [navigate],
  );

  function handleBulkDelete() {
    const targets = datasets
      .filter((d) => selectedIds.has(d.id))
      .map((d) => ({ id: d.id, name: d.name, fileCount: d.fileCount }));
    if (targets.length > 0) {
      setBulkDeleteTargets(targets);
    }
  }

  return (
    <div className="space-y-4" data-testid="datasets-page">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">Datasets</h1>
        <Button onClick={() => setUploadOpen(true)} data-testid="upload-dataset-button">
          <Plus className="mr-2 h-4 w-4" />
          Upload Dataset
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search datasets..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="max-w-sm"
          data-testid="datasets-search"
        />
        <Select
          value={statusFilter || "all"}
          onValueChange={(v) => {
            setStatusFilter(v === "all" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]" data-testid="datasets-status-filter">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="UPLOADING">Uploading</SelectItem>
            <SelectItem value="EXTRACTING">Extracting</SelectItem>
            <SelectItem value="READY">Ready</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
          </SelectContent>
        </Select>
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={handleBulkDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border">
          <TableSkeleton rows={8} columns={7} />
        </div>
      ) : (
        <>
          <div className="rounded-lg border" data-testid="datasets-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Files</TableHead>
                  <TableHead className="hidden md:table-cell w-[180px]">Progress</TableHead>
                  <TableHead className="hidden md:table-cell">Uploaded By</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="p-0" data-testid="datasets-empty-state">
                      <EmptyState
                        icon={Database}
                        title="No datasets found"
                        description={!search && !statusFilter ? "Upload your first dataset to get started" : undefined}
                        action={
                          !search && !statusFilter ? (
                            <Button onClick={() => setUploadOpen(true)} size="sm">
                              <Plus className="mr-2 h-4 w-4" />
                              Upload Dataset
                            </Button>
                          ) : undefined
                        }
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  datasets.map((dataset) => (
                    <TableRow
                      key={dataset.id}
                      className="cursor-pointer"
                      onClick={() => handleRowClick(dataset.id)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedIds.has(dataset.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(dataset.id, !!checked)
                          }
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        {dataset.name}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={dataset.status} type="dataset" />
                      </TableCell>
                      <TableCell>
                        <span>{dataset.fileCount}</span>
                        {(dataset.duplicateCount > 0 || dataset.excludedCount > 0) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="ml-1 text-xs text-muted-foreground cursor-default">*</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="text-xs space-y-0.5">
                                  {dataset.duplicateCount > 0 && (
                                    <div>{dataset.duplicateCount} duplicate(s) skipped</div>
                                  )}
                                  {dataset.excludedCount > 0 && (
                                    <div>{dataset.excludedCount} excluded by blocklist</div>
                                  )}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <StackedProgressBar
                          statusSummary={dataset.statusSummary}
                          fileCount={dataset.fileCount}
                        />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {dataset.uploadedBy?.name ?? (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="cursor-default">{formatRelativeDate(dataset.uploadDate)}</span>
                            </TooltipTrigger>
                            <TooltipContent>{formatAbsoluteDate(dataset.uploadDate)}</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-label="Download dataset CSV"
                                data-testid="dataset-download-button"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel className="max-w-[200px] truncate">
                                {dataset.name}
                              </DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await downloadDatasetCsv({
                                      datasetId: dataset.id,
                                      datasetName: dataset.name,
                                      includeAnnotations: false,
                                    });
                                    toast.success("CSV downloaded");
                                  } catch {
                                    toast.error("Failed to download CSV");
                                  }
                                }}
                              >
                                Jobs Only
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={async () => {
                                  try {
                                    await downloadDatasetCsv({
                                      datasetId: dataset.id,
                                      datasetName: dataset.name,
                                      includeAnnotations: true,
                                    });
                                    toast.success("CSV downloaded");
                                  } catch {
                                    toast.error("Failed to download CSV");
                                  }
                                }}
                              >
                                Jobs with Annotations
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(dataset)}
                            aria-label="Delete dataset"
                            data-testid="dataset-delete-button"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div data-testid="datasets-pagination">
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={data?.count ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </>
      )}

      <DatasetUploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />

      {/* Single delete */}
      <DatasetDeleteConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(val) => !val && setDeleteTarget(null)}
        datasetId={deleteTarget?.id ?? null}
        datasetName={deleteTarget?.name ?? ""}
        fileCount={deleteTarget?.fileCount ?? 0}
        onComplete={() => {
          setDeleteTarget(null);
          setSelectedIds(new Set());
        }}
      />

      {/* Bulk delete */}
      <DatasetDeleteConfirmDialog
        open={!!bulkDeleteTargets}
        onOpenChange={(val) => !val && setBulkDeleteTargets(null)}
        datasets={bulkDeleteTargets ?? undefined}
        onComplete={() => {
          setBulkDeleteTargets(null);
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
}
