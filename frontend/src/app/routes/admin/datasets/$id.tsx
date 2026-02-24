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
import { useJobAnnotatedContent } from "@/features/datasets/api/get-job-annotated-content";
import { DatasetStatusCards } from "@/features/datasets/components/dataset-status-cards";
import { DatasetJobsTable } from "@/features/datasets/components/dataset-jobs-table";
import { StatusBadge } from "@/features/datasets/components/status-badge";
import { JobDeleteConfirmDialog } from "@/features/datasets/components/job-delete-confirm-dialog";
import { JobResetConfirmDialog } from "@/features/datasets/components/job-reset-confirm-dialog";
import { useJobDialogState } from "@/features/datasets/hooks/use-job-dialog-state";
import { useJobActionDialogs } from "@/features/datasets/hooks/use-job-action-dialogs";
import { apiClient } from "@/lib/api-client";
import { formatRelativeDate, formatAbsoluteDate } from "@/lib/format-date";
import { JobStatus } from "@/types/enums";
import { EmailViewer } from "@/components/email-viewer";
import { RawContentViewer } from "@/components/raw-content-viewer";
import { SectionedContentViewer } from "@/components/sectioned-content-viewer";
import { EmailPreview } from "@/components/email-preview";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVersionHistory } from "@/features/version-history/api/get-version-history";
import { useJobInfo } from "@/features/version-history/api/get-job-info";
import { VersionTimeline } from "@/features/version-history/components/version-timeline";
import { VersionDetailView } from "@/features/version-history/components/version-detail-view";

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

  const { data: dataset, isLoading: datasetLoading } = useDataset(id);
  const { data: jobsData, isLoading: jobsLoading } = useJobsByDataset({
    datasetId: id,
    page,
    pageSize,
    search,
    status: statusFilter || undefined,
  });

  const jobs = jobsData?.results ?? [];

  // Custom hooks for dialog state management
  const jobDialog = useJobDialogState(jobs);
  const actionDialogs = useJobActionDialogs();

  const { data: rawContent, isLoading: rawContentLoading } =
    useJobRawContent(jobDialog.dialogJobId);
  const { data: historyData, isLoading: historyLoading } =
    useVersionHistory(jobDialog.dialogJobId ?? "");
  const { data: jobInfo } = useJobInfo(jobDialog.dialogJobId ?? "");
  const { data: annotatedContent } = useJobAnnotatedContent(jobDialog.dialogJobId);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // Clear selection when page changes
  useEffect(() => {
    setSelectedJobIds(new Set());
  }, [page]);

  const handleStatusClick = useCallback((status: string) => {
    setStatusFilter(status);
    setPage(1);
  }, []);

  const handleViewVersion = useCallback(
    (versionId: string) => {
      const version = historyData?.annotationVersions.find(
        (v) => v.id === versionId,
      );
      if (version) {
        jobDialog.setDetailVersion(version);
      }
    },
    [historyData, jobDialog],
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

  const handleDeleteComplete = useCallback(() => {
    actionDialogs.close();
    setSelectedJobIds(new Set());
  }, [actionDialogs]);

  const handleResetComplete = useCallback(() => {
    actionDialogs.close();
    setSelectedJobIds(new Set());
  }, [actionDialogs]);

  const handleDialogClose = useCallback((open: boolean) => {
    if (!open) {
      jobDialog.close();
    }
  }, [jobDialog]);

  const RESETTABLE_STATUSES: JobStatus[] = [
    JobStatus.DELIVERED,
    JobStatus.QA_ACCEPTED,
    JobStatus.QA_REJECTED,
    JobStatus.DISCARDED,
  ];

  const resettableSelectedCount = jobs.filter(
    (j) => selectedJobIds.has(j.id) && RESETTABLE_STATUSES.includes(j.status),
  ).length;

  if (datasetLoading) {
    return (
      <div className="space-y-6" data-testid="dataset-detail-skeleton">
        <div>
          <Skeleton className="mb-2 h-4 w-32" />
          <Skeleton className="h-8 w-64" />
          <div className="mt-2 flex items-center gap-3">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="rounded-lg border">
          <TableSkeleton rows={8} columns={6} />
        </div>
      </div>
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
                Uploaded by {dataset.uploadedBy?.name ?? "Unknown"}{" "}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-default">{formatRelativeDate(dataset.uploadDate)}</span>
                    </TooltipTrigger>
                    <TooltipContent>{formatAbsoluteDate(dataset.uploadDate)}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
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
        {selectedJobIds.size > 0 && resettableSelectedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={actionDialogs.openBulkReset}
            data-testid="bulk-reset-button"
          >
            Reset Selected ({resettableSelectedCount})
          </Button>
        )}
        {selectedJobIds.size > 0 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={actionDialogs.openBulkDelete}
            data-testid="bulk-delete-button"
          >
            Delete Selected ({selectedJobIds.size})
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
              onJobClick={jobDialog.openForJob}
              onHistoryClick={jobDialog.openForHistory}
              onDownloadClick={handleDownloadEml}
              onDeleteClick={actionDialogs.openDelete}
              onResetClick={actionDialogs.openReset}
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

      <Dialog open={!!jobDialog.dialogJobId} onOpenChange={handleDialogClose}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col" data-testid="email-viewer-dialog">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2">
              <div>
                <DialogTitle>
                  {jobDialog.dialogJob?.fileName ?? "Email Preview"}
                </DialogTitle>
                <DialogDescription>
                  {jobDialog.dialogJob
                    ? `Status: ${jobDialog.dialogJob.status.replace(/_/g, " ").toLowerCase()}`
                    : "Loading..."}
                </DialogDescription>
              </div>
              {jobDialog.dialogJob && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadEml(jobDialog.dialogJob!.id, jobDialog.dialogJob!.fileName)}
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
              <Tabs value={jobDialog.dialogTab} onValueChange={jobDialog.setDialogTab}>
                <TabsList className="w-fit">
                  <TabsTrigger value="email" data-testid="email-tab">Email</TabsTrigger>
                  <TabsTrigger value="raw" data-testid="raw-tab">Raw Content</TabsTrigger>
                  {annotatedContent?.hasAnnotations && (
                    <TabsTrigger value="annotated" data-testid="annotated-tab">Annotated</TabsTrigger>
                  )}
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
                {annotatedContent?.hasAnnotations && (
                  <TabsContent value="annotated" className="h-[65vh]">
                    <ResizablePanelGroup orientation="horizontal">
                      <ResizablePanel defaultSize={55} minSize={30}>
                        <SectionedContentViewer
                          sections={annotatedContent.sections}
                          annotations={annotatedContent.annotations}
                          readOnly
                        />
                      </ResizablePanel>
                      <ResizableHandle withHandle />
                      <ResizablePanel defaultSize={45} minSize={25}>
                        <EmailPreview
                          rawContent={annotatedContent.rawContent}
                          sections={annotatedContent.sections}
                          annotations={annotatedContent.annotations}
                        />
                      </ResizablePanel>
                    </ResizablePanelGroup>
                  </TabsContent>
                )}
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
        open={jobDialog.detailViewOpen}
        onOpenChange={jobDialog.setDetailViewOpen}
        version={jobDialog.detailVersion}
      />

      <JobDeleteConfirmDialog
        open={actionDialogs.deleteDialogOpen}
        onOpenChange={(val) => !val && actionDialogs.close()}
        datasetId={id}
        jobId={actionDialogs.deleteIsBulk ? null : actionDialogs.deleteJobId}
        jobFileName={actionDialogs.deleteJobFileName}
        jobIds={actionDialogs.deleteIsBulk ? Array.from(selectedJobIds) : undefined}
        hasInProgress={
          actionDialogs.deleteIsBulk
            ? jobs.some(
                (j) =>
                  selectedJobIds.has(j.id) &&
                  (j.status === JobStatus.ANNOTATION_IN_PROGRESS ||
                    j.status === JobStatus.QA_IN_PROGRESS),
              )
            : jobs.some(
                (j) =>
                  j.id === actionDialogs.deleteJobId &&
                  (j.status === JobStatus.ANNOTATION_IN_PROGRESS ||
                    j.status === JobStatus.QA_IN_PROGRESS),
              )
        }
        onComplete={handleDeleteComplete}
      />

      <JobResetConfirmDialog
        open={actionDialogs.resetDialogOpen}
        onOpenChange={(val) => !val && actionDialogs.close()}
        datasetId={id}
        jobId={actionDialogs.resetIsBulk ? null : actionDialogs.resetJobId}
        jobFileName={actionDialogs.resetJobFileName}
        jobStatus={actionDialogs.resetJobStatus}
        jobIds={
          actionDialogs.resetIsBulk
            ? jobs
                .filter(
                  (j) =>
                    selectedJobIds.has(j.id) &&
                    RESETTABLE_STATUSES.includes(j.status),
                )
                .map((j) => j.id)
            : undefined
        }
        onComplete={handleResetComplete}
      />
    </div>
  );
}
