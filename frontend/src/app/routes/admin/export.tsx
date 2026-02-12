import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useExportDatasets } from "@/features/export/api/get-datasets-with-delivered";
import { useDeliveredJobs } from "@/features/export/api/get-delivered-jobs";
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

function ExportPage() {
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null,
  );
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [previewJobId, setPreviewJobId] = useState<string | null>(null);

  const { data: datasets } = useExportDatasets();
  const { data: jobs } = useDeliveredJobs(selectedDatasetId);
  const { data: preview } = useExportPreview(previewJobId);
  const { data: exportHistory } = useExportHistory({ page: 1 });
  const createExport = useCreateExport();

  const handleDatasetChange = useCallback((value: string) => {
    setSelectedDatasetId(value);
    setSelectedJobIds(new Set());
    setPreviewJobId(null);
  }, []);

  const handlePreview = useCallback(() => {
    const ids = Array.from(selectedJobIds);
    if (ids.length === 1) {
      setPreviewJobId(ids[0]);
    }
  }, [selectedJobIds]);

  const handleExportSelected = useCallback(() => {
    createExport.mutate(
      { jobIds: Array.from(selectedJobIds) },
      {
        onSuccess: (data) => {
          // Trigger download
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
                {jobs.length} delivered job(s) in this dataset
              </CardDescription>
            </div>
            <ExportControls
              selectedCount={selectedJobIds.size}
              totalCount={jobs.length}
              isExporting={createExport.isPending}
              onPreview={handlePreview}
              onExportSelected={handleExportSelected}
              onExportAll={handleExportAll}
            />
          </CardHeader>
          <CardContent>
            <DeliveredJobsTable
              jobs={jobs}
              selectedIds={selectedJobIds}
              onSelectionChange={setSelectedJobIds}
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
