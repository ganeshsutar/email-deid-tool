import { useState, useCallback, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useExportDatasets } from "@/features/export/api/get-datasets-with-delivered";
import { useDeliveredJobs, useAllDeliveredJobs } from "@/features/export/api/get-delivered-jobs";
import { useExportPreview } from "@/features/export/api/get-export-preview";
import { useExportHistory } from "@/features/export/api/get-export-history";
import { useCreateExport } from "@/features/export/api/create-export";
import { DeliveredJobsTable } from "@/features/export/components/delivered-jobs-table";
import { ExportControls } from "@/features/export/components/export-controls";
import { ExportPreviewDialog } from "@/features/export/components/export-preview";
import { ExportHistoryTable } from "@/features/export/components/export-history-table";

export const Route = createFileRoute("/admin/export")({
  component: ExportPage,
});

const ALL_DATASETS_VALUE = "all";

function ExportPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null,
  );
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const isAllDatasets = selectedDatasetId === ALL_DATASETS_VALUE;
  const singleDatasetId = selectedDatasetId && !isAllDatasets ? selectedDatasetId : null;

  const { data: datasets } = useExportDatasets();
  const { data: singleDatasetJobs } = useDeliveredJobs(singleDatasetId);
  const { data: allDatasetJobs } = useAllDeliveredJobs(isAllDatasets);
  const { data: preview } = useExportPreview(previewJobId);
  const { data: exportHistory } = useExportHistory({ page: 1 });
  const createExport = useCreateExport();

  const allJobs = isAllDatasets ? allDatasetJobs : singleDatasetJobs;

  const filteredJobs = useMemo(() => {
    if (!allJobs || !searchQuery.trim()) return allJobs;
    const q = searchQuery.toLowerCase();
    return allJobs.filter(
      (job) =>
        job.fileName.toLowerCase().includes(q) ||
        job.annotator?.name.toLowerCase().includes(q) ||
        job.qaReviewer?.name.toLowerCase().includes(q) ||
        job.datasetName?.toLowerCase().includes(q),
    );
  }, [allJobs, searchQuery]);

  const jobs = filteredJobs;

  const totalDeliveredCount = useMemo(
    () => datasets?.reduce((sum, ds) => sum + ds.deliveredCount, 0) ?? 0,
    [datasets],
  );

  const handleDatasetChange = useCallback((value: string) => {
    setSelectedDatasetId(value);
    setSelectedJobIds(new Set());
    setPreviewJobId(null);
    setSearchQuery("");
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize: number) => {
    setPageSize(newPageSize);
    setPage(1);
  }, []);

  const handlePreview = useCallback((jobId: string) => {
    setPreviewJobId(jobId);
  }, []);

  const handleExportSelected = useCallback(() => {
    createExport.mutate(
      { jobIds: Array.from(selectedJobIds) },
      {
        onSuccess: (data) => {
          window.open(data.downloadUrl, "_blank");
        },
      },
    );
  }, [selectedJobIds, createExport]);

  const handleExportAll = useCallback(() => {
    if (!jobs) return;
    createExport.mutate(
      { jobIds: jobs.map((j) => j.id) },
      {
        onSuccess: (data) => {
          window.open(data.downloadUrl, "_blank");
        },
      },
    );
  }, [jobs, createExport]);

  const totalJobCount = allJobs?.length ?? 0;
  const filteredCount = jobs?.length ?? 0;
  const isFiltered = searchQuery.trim() !== "" && filteredCount !== totalJobCount;
  const jobsDescription = isFiltered
    ? `Showing ${filteredCount} of ${totalJobCount} delivered jobs`
    : isAllDatasets
      ? `${totalJobCount} delivered job(s) across all datasets`
      : `${totalJobCount} delivered job(s) in this dataset`;

  return (
    <div className="space-y-6" data-testid="export-page">
      <div>
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">
          Export
        </h1>
        <p className="text-muted-foreground">
          Export de-identified emails from delivered jobs
        </p>
      </div>

      {/* Dataset selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Dataset</CardTitle>
          <CardDescription>
            Choose a dataset with delivered jobs to export
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedDatasetId ?? ""}
            onValueChange={handleDatasetChange}
          >
            <SelectTrigger className="w-[400px]" data-testid="export-dataset-select">
              <SelectValue placeholder="Select a dataset" />
            </SelectTrigger>
            <SelectContent>
              {totalDeliveredCount > 0 && (
                <SelectItem value={ALL_DATASETS_VALUE}>
                  All Datasets ({totalDeliveredCount} delivered)
                </SelectItem>
              )}
              {datasets?.map((ds) => (
                <SelectItem key={ds.id} value={ds.id}>
                  {ds.name} ({ds.deliveredCount} delivered)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Delivered jobs + controls */}
      {selectedDatasetId && jobs && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Delivered Jobs</CardTitle>
              <CardDescription>
                {jobsDescription}
              </CardDescription>
            </div>
            <ExportControls
              selectedCount={selectedJobIds.size}
              totalCount={jobs.length}
              isExporting={createExport.isPending}
              onExportSelected={handleExportSelected}
              onExportAll={handleExportAll}
            />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by file name, annotator, or reviewer..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-8"
                data-testid="export-search-input"
              />
            </div>
            <DeliveredJobsTable
              jobs={jobs}
              selectedIds={selectedJobIds}
              onSelectionChange={setSelectedJobIds}
              page={page}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
              onPreview={handlePreview}
              showDatasetColumn={isAllDatasets}
            />
          </CardContent>
        </Card>
      )}

      {/* Preview */}
      {preview && (
        <ExportPreviewDialog
          data={preview}
          open
          onOpenChange={(open) => {
            if (!open) setPreviewJobId(null);
          }}
        />
      )}

      {/* Export History */}
      <Card>
        <CardHeader>
          <CardTitle>Export History</CardTitle>
          <CardDescription>Previous exports and downloads</CardDescription>
        </CardHeader>
        <CardContent>
          <ExportHistoryTable exports={exportHistory?.results ?? []} />
        </CardContent>
      </Card>
    </div>
  );
}
