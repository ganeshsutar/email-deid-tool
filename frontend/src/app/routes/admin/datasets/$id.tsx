import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download } from "lucide-react";
import { DataTablePagination } from "@/components/data-table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import {
  datasetQueryOptions,
  useDataset,
} from "@/features/datasets/api/get-dataset";
import { useJobsByDataset } from "@/features/datasets/api/get-jobs-by-dataset";
import { useJobRawContent } from "@/features/datasets/api/get-job-raw-content";
import { DatasetStatusCards } from "@/features/datasets/components/dataset-status-cards";
import { DatasetJobsTable } from "@/features/datasets/components/dataset-jobs-table";
import { StatusBadge } from "@/features/datasets/components/status-badge";
import { apiClient } from "@/lib/api-client";
import { EmailViewer } from "@/components/email-viewer";
import { RawContentViewer } from "@/components/raw-content-viewer";
import { useVersionHistory } from "@/features/version-history/api/get-version-history";
import { useJobInfo } from "@/features/version-history/api/get-job-info";
import { VersionTimeline } from "@/features/version-history/components/version-timeline";
import { VersionDetailView } from "@/features/version-history/components/version-detail-view";
import type { AnnotationVersionSummary } from "@/features/version-history/api/history-mapper";

export const Route = createFileRoute("/admin/datasets/$id")({
  loader: async ({ context: { queryClient }, params: { id } }) => {
    const dataset = await queryClient.ensureQueryData(
      datasetQueryOptions(id),
    );
    return { name: dataset.name };
  },
  component: DatasetDetailPage,
});

function DatasetDetailPage() {
  const { id } = Route.useParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [dialogJobId, setDialogJobId] = useState<string | null>(null);
  const [dialogTab, setDialogTab] = useState("email");
  const [detailViewOpen, setDetailViewOpen] = useState(false);
  const [detailVersion, setDetailVersion] = useState<AnnotationVersionSummary | null>(null);

  const { data: dataset, isLoading: datasetLoading } = useDataset(id);
  const { data: jobsData, isLoading: jobsLoading } = useJobsByDataset({
    datasetId: id,
    page,
    pageSize,
    search,
    status: statusFilter || undefined,
  });
  const { data: rawContent, isLoading: rawContentLoading } =
    useJobRawContent(dialogJobId);
  const { data: historyData, isLoading: historyLoading } =
    useVersionHistory(dialogJobId ?? "");
  const { data: jobInfo } = useJobInfo(dialogJobId ?? "");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  const handleStatusClick = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const handleJobClick = useCallback((jobId: string) => {
    setDialogJobId(jobId);
    setDialogTab("email");
  }, []);

  const handleHistoryClick = useCallback((jobId: string) => {
    setDialogJobId(jobId);
    setDialogTab("history");
  }, []);

  const handleViewVersion = useCallback(
    (versionId: string) => {
      const version = historyData?.annotationVersions.find(
        (v) => v.id === versionId,
      );
      if (version) {
        setDetailVersion(version);
        setDetailViewOpen(true);
      }
    },
    [historyData],
  );

  const handleDownloadEml = useCallback(async (jobId: string, fileName: string) => {
    const response = await apiClient.get<string>(`/jobs/${jobId}/raw-content/`, {
      transformResponse: [(data: string) => data],
    });
    const blob = new Blob([response.data], { type: "message/rfc822" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      setDialogJobId(null);
      setDialogTab("email");
      setDetailViewOpen(false);
      setDetailVersion(null);
    }
  }, []);

  const jobs = jobsData?.results ?? [];

  const dialogJob = dialogJobId
    ? jobs.find((j) => j.id === dialogJobId)
    : null;

  if (datasetLoading) {
    return (
      <div className="py-8 text-center text-muted-foreground">Loading...</div>
    );
  }

  if (!dataset) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Dataset not found.
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="dataset-detail-page">
      <div>
        <Link
          to="/admin/datasets"
          className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Datasets
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{dataset.name}</h1>
            <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
              <StatusBadge status={dataset.status} type="dataset" />
              <span>{dataset.fileCount} files</span>
              <span>
                Uploaded by {dataset.uploadedBy?.name ?? "Unknown"} on{" "}
                {new Date(dataset.uploadDate).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      <DatasetStatusCards
        statusSummary={dataset.statusSummary}
        activeStatus={statusFilter}
        onStatusClick={handleStatusClick}
      />

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search jobs by filename..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          className="max-w-sm"
          data-testid="dataset-jobs-search"
        />
        {statusFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter("");
              setPage(1);
            }}
          >
            Clear Filter
          </Button>
        )}
      </div>

      {jobsLoading ? (
        <div className="rounded-lg border">
          <TableSkeleton rows={8} columns={6} />
        </div>
      ) : (
        <>
          <div className="rounded-lg border">
            <DatasetJobsTable
              jobs={jobs}
              selectedIds={selectedJobIds}
              onSelectionChange={setSelectedJobIds}
              onJobClick={handleJobClick}
              onHistoryClick={handleHistoryClick}
              onDownloadClick={handleDownloadEml}
            />
          </div>
          <div data-testid="dataset-jobs-pagination">
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={jobsData?.count ?? 0}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </>
      )}

      <Dialog open={!!dialogJobId} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col" data-testid="email-viewer-dialog">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle>
                  {dialogJob?.fileName ?? "Email Preview"}
                </DialogTitle>
                <DialogDescription>
                  {dialogJob
                    ? `Status: ${dialogJob.status.replace(/_/g, " ").toLowerCase()}`
                    : "Loading..."}
                </DialogDescription>
              </div>
              {dialogJob && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadEml(dialogJob.id, dialogJob.fileName)}
                  data-testid="dialog-download-button"
                >
                  <Download className="h-4 w-4 mr-1.5" />
                  Download
                </Button>
              )}
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto">
            {rawContentLoading ? (
              <div className="space-y-2 p-1">
                {Array.from({ length: 12 }, (_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            ) : rawContent ? (
              <Tabs value={dialogTab} onValueChange={setDialogTab}>
                <TabsList className="w-fit">
                  <TabsTrigger value="email" data-testid="email-tab">Email</TabsTrigger>
                  <TabsTrigger value="raw" data-testid="raw-tab">Raw Content</TabsTrigger>
                  <TabsTrigger value="history" data-testid="history-tab">History</TabsTrigger>
                </TabsList>
                <TabsContent value="email">
                  <EmailViewer rawContent={rawContent} />
                </TabsContent>
                <TabsContent value="raw" className="max-h-[65vh] overflow-auto">
                  <RawContentViewer
                    content={rawContent}
                    annotations={[]}
                    readOnly
                  />
                </TabsContent>
                <TabsContent value="history">
                  {historyLoading ? (
                    <div className="space-y-2 p-4">
                      {Array.from({ length: 6 }, (_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : historyData ? (
                    <VersionTimeline
                      annotationVersions={historyData.annotationVersions}
                      qaReviewVersions={historyData.qaReviewVersions}
                      jobCreatedAt={jobInfo?.createdAt ?? ""}
                      onViewVersion={handleViewVersion}
                      onCompareVersion={() => {}}
                      showCompare={false}
                    />
                  ) : (
                    <p className="text-sm text-muted-foreground p-4">
                      Could not load version history.
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              <p className="text-sm text-muted-foreground">
                Could not load email content.
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <VersionDetailView
        open={detailViewOpen}
        onOpenChange={setDetailViewOpen}
        version={detailVersion}
      />
    </div>
  );
}
