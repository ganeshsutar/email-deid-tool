import { useCallback, useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Download, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DataTablePagination } from "@/components/data-table-pagination";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { downloadDatasetCsv } from "@/features/datasets/api/download-dataset-csv";
import { useDatasets } from "@/features/datasets/api/get-datasets";
import { StatusBadge } from "@/features/datasets/components/status-badge";
import { DatasetUploadDialog } from "@/features/datasets/components/dataset-upload-dialog";
import { DatasetDeleteConfirmDialog } from "@/features/datasets/components/dataset-delete-confirm-dialog";
import type { DatasetSummary } from "@/features/datasets/api/dataset-mapper";

export const Route = createFileRoute("/admin/datasets/")({
  component: DatasetsPage,
});

function DatasetsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DatasetSummary | null>(null);

  const { data, isLoading } = useDatasets({ page, pageSize, search });

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
        {selectedIds.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            onClick={() => {
              const target = datasets.find((d) => selectedIds.has(d.id));
              if (target) setDeleteTarget(target);
            }}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete Selected ({selectedIds.size})
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-lg border">
          <TableSkeleton rows={8} columns={6} />
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
                  <TableHead>Uploaded By</TableHead>
                  <TableHead>Upload Date</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {datasets.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center" data-testid="datasets-empty-state">
                      No datasets found.
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
                      <TableCell>{dataset.fileCount}</TableCell>
                      <TableCell>
                        {dataset.uploadedBy?.name ?? (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(dataset.uploadDate).toLocaleDateString()}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
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
    </div>
  );
}
