import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTablePagination } from "@/components/data-table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useUnassignedJobs } from "@/features/job-assignment/api/get-unassigned-jobs";
import { useAssignedJobs } from "@/features/job-assignment/api/get-assigned-jobs";
import { useInProgressJobs } from "@/features/job-assignment/api/get-in-progress-jobs";
import { useDatasets } from "@/features/datasets/api/get-datasets";
import { UnassignedJobsTable } from "@/features/job-assignment/components/unassigned-jobs-table";
import { AssignedJobsTable } from "@/features/job-assignment/components/assigned-jobs-table";
import { AssignmentControlsPanel } from "@/features/job-assignment/components/assignment-controls-panel";
import { AssignmentPreviewDialog } from "@/features/job-assignment/components/assignment-preview-dialog";
import { BulkReassignDialog } from "@/features/job-assignment/components/bulk-reassign-dialog";
import { computeRoundRobinDistribution } from "@/features/job-assignment/utils/round-robin";
import type { AssignmentPreview } from "@/features/job-assignment/utils/round-robin";
import type { User } from "@/types/models";
import type { UserWorkload } from "@/features/job-assignment/api/get-user-workloads";

export const Route = createFileRoute("/admin/job-assignment")({
  component: JobAssignmentPage,
});

function JobAssignmentPage() {
  const [activeTab, setActiveTab] = useState<"ANNOTATION" | "QA">("ANNOTATION");
  const [subTab, setSubTab] = useState<"unassigned" | "assigned" | "in-progress">("unassigned");

  // Unassigned state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [localSearch, setLocalSearch] = useState("");
  const [datasetId, setDatasetId] = useState("all");
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [previewOpen, setPreviewOpen] = useState(false);
  const [preview, setPreview] = useState<AssignmentPreview[]>([]);

  // Assigned state
  const [assignedPage, setAssignedPage] = useState(1);
  const [assignedSearch, setAssignedSearch] = useState("");
  const [assignedLocalSearch, setAssignedLocalSearch] = useState("");
  const [assignedDatasetId, setAssignedDatasetId] = useState("all");
  const [assignedSelectedIds, setAssignedSelectedIds] = useState<Set<string>>(new Set());
  const [reassignOpen, setReassignOpen] = useState(false);

  // In Progress state
  const [inProgressPage, setInProgressPage] = useState(1);
  const [inProgressSearch, setInProgressSearch] = useState("");
  const [inProgressLocalSearch, setInProgressLocalSearch] = useState("");
  const [inProgressDatasetId, setInProgressDatasetId] = useState("all");
  const [inProgressSelectedIds, setInProgressSelectedIds] = useState<Set<string>>(new Set());
  const [inProgressReassignOpen, setInProgressReassignOpen] = useState(false);

  // Page size state
  const [pageSize, setPageSize] = useState(20);
  const [assignedPageSize, setAssignedPageSize] = useState(20);
  const [inProgressPageSize, setInProgressPageSize] = useState(20);

  const { data: jobsData, isLoading: jobsLoading } = useUnassignedJobs({
    type: activeTab,
    page,
    search,
    datasetId: datasetId === "all" ? undefined : datasetId,
    pageSize,
  });

  const { data: assignedData, isLoading: assignedLoading } = useAssignedJobs({
    type: activeTab,
    page: assignedPage,
    search: assignedSearch,
    datasetId: assignedDatasetId === "all" ? undefined : assignedDatasetId,
    pageSize: assignedPageSize,
  });

  const { data: inProgressData, isLoading: inProgressLoading } = useInProgressJobs({
    type: activeTab,
    page: inProgressPage,
    search: inProgressSearch,
    datasetId: inProgressDatasetId === "all" ? undefined : inProgressDatasetId,
    pageSize: inProgressPageSize,
  });

  const { data: datasetsData } = useDatasets({ pageSize: 100 });

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setAssignedSearch(assignedLocalSearch);
      setAssignedPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [assignedLocalSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setInProgressSearch(inProgressLocalSearch);
      setInProgressPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [inProgressLocalSearch]);

  function handleTabChange(tab: string) {
    setActiveTab(tab as "ANNOTATION" | "QA");
    setSubTab("unassigned");
    setPage(1);
    setSearch("");
    setLocalSearch("");
    setDatasetId("all");
    setSelectedJobIds(new Set());
    setAssignedPage(1);
    setAssignedSearch("");
    setAssignedLocalSearch("");
    setAssignedDatasetId("all");
    setAssignedSelectedIds(new Set());
    setInProgressPage(1);
    setInProgressSearch("");
    setInProgressLocalSearch("");
    setInProgressDatasetId("all");
    setInProgressSelectedIds(new Set());
  }

  function handleSubTabChange(tab: string) {
    setSubTab(tab as "unassigned" | "assigned" | "in-progress");
    setSelectedJobIds(new Set());
    setAssignedSelectedIds(new Set());
    setInProgressSelectedIds(new Set());
  }

  const handleAssignComplete = useCallback(() => {
    setSelectedJobIds(new Set());
  }, []);

  const handleReassignComplete = useCallback(() => {
    setAssignedSelectedIds(new Set());
  }, []);

  const handleInProgressReassignComplete = useCallback(() => {
    setInProgressSelectedIds(new Set());
  }, []);

  function handlePreviewRoundRobin(
    selectedUsers: User[],
    workloads: UserWorkload[],
  ) {
    const result = computeRoundRobinDistribution(
      Array.from(selectedJobIds),
      selectedUsers,
      workloads,
    );
    setPreview(result);
    setPreviewOpen(true);
  }

  const jobs = jobsData?.results ?? [];
  const assignedJobs = assignedData?.results ?? [];
  const inProgressJobs = inProgressData?.results ?? [];
  const datasets = datasetsData?.results ?? [];

  return (
    <div className="space-y-4" data-testid="job-assignment-page">
      <h1 className="text-2xl font-bold">Job Assignment</h1>

      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ANNOTATION" data-testid="annotation-assignment-tab">Annotation Assignment</TabsTrigger>
          <TabsTrigger value="QA" data-testid="qa-assignment-tab">QA Assignment</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4 space-y-4">
          <Tabs value={subTab} onValueChange={handleSubTabChange}>
            <TabsList>
              <TabsTrigger value="unassigned" data-testid="unassigned-subtab">Unassigned</TabsTrigger>
              <TabsTrigger value="assigned" data-testid="assigned-subtab">Assigned</TabsTrigger>
              <TabsTrigger value="in-progress" data-testid="in-progress-subtab">In Progress</TabsTrigger>
            </TabsList>

            <TabsContent value="unassigned" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search jobs..."
                    value={localSearch}
                    onChange={(e) => setLocalSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={datasetId} onValueChange={(v) => { setDatasetId(v); setPage(1); }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Datasets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Datasets</SelectItem>
                      {datasets.map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>
                          {ds.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-start gap-6">
                  <div className="flex-1 space-y-4">
                    {jobsLoading ? (
                      <div className="rounded-lg border">
                        <TableSkeleton rows={8} columns={4} />
                      </div>
                    ) : (
                      <>
                        <UnassignedJobsTable
                          jobs={jobs}
                          selectedIds={selectedJobIds}
                          onSelectionChange={setSelectedJobIds}
                        />

                        <DataTablePagination
                          page={page}
                          pageSize={pageSize}
                          totalCount={jobsData?.count ?? 0}
                          onPageChange={setPage}
                          onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
                        />
                      </>
                    )}
                  </div>

                  <div className="w-72 shrink-0">
                    <AssignmentControlsPanel
                      selectedJobIds={selectedJobIds}
                      type={activeTab}
                      onAssignComplete={handleAssignComplete}
                      onPreviewRoundRobin={handlePreviewRoundRobin}
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="assigned" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search assigned jobs..."
                    value={assignedLocalSearch}
                    onChange={(e) => setAssignedLocalSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={assignedDatasetId} onValueChange={(v) => { setAssignedDatasetId(v); setAssignedPage(1); }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Datasets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Datasets</SelectItem>
                      {datasets.map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>
                          {ds.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <Button
                    data-testid="reassign-button"
                    disabled={assignedSelectedIds.size === 0}
                    onClick={() => setReassignOpen(true)}
                  >
                    Reassign ({assignedSelectedIds.size})
                  </Button>
                </div>

                {assignedLoading ? (
                  <div className="rounded-lg border">
                    <TableSkeleton rows={8} columns={5} />
                  </div>
                ) : (
                  <>
                    <AssignedJobsTable
                      jobs={assignedJobs}
                      selectedIds={assignedSelectedIds}
                      onSelectionChange={setAssignedSelectedIds}
                    />

                    <DataTablePagination
                      page={assignedPage}
                      pageSize={assignedPageSize}
                      totalCount={assignedData?.count ?? 0}
                      onPageChange={setAssignedPage}
                      onPageSizeChange={(size) => { setAssignedPageSize(size); setAssignedPage(1); }}
                    />
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="in-progress" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    placeholder="Search in-progress jobs..."
                    value={inProgressLocalSearch}
                    onChange={(e) => setInProgressLocalSearch(e.target.value)}
                    className="max-w-sm"
                  />
                  <Select value={inProgressDatasetId} onValueChange={(v) => { setInProgressDatasetId(v); setInProgressPage(1); }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="All Datasets" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Datasets</SelectItem>
                      {datasets.map((ds) => (
                        <SelectItem key={ds.id} value={ds.id}>
                          {ds.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex-1" />
                  <Button
                    data-testid="reassign-button"
                    disabled={inProgressSelectedIds.size === 0}
                    onClick={() => setInProgressReassignOpen(true)}
                  >
                    Reassign ({inProgressSelectedIds.size})
                  </Button>
                </div>

                {inProgressLoading ? (
                  <div className="rounded-lg border">
                    <TableSkeleton rows={8} columns={5} />
                  </div>
                ) : (
                  <>
                    <AssignedJobsTable
                      jobs={inProgressJobs}
                      selectedIds={inProgressSelectedIds}
                      onSelectionChange={setInProgressSelectedIds}
                    />

                    <DataTablePagination
                      page={inProgressPage}
                      pageSize={inProgressPageSize}
                      totalCount={inProgressData?.count ?? 0}
                      onPageChange={setInProgressPage}
                      onPageSizeChange={(size) => { setInProgressPageSize(size); setInProgressPage(1); }}
                    />
                  </>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      <AssignmentPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        type={activeTab}
        onComplete={handleAssignComplete}
      />

      <BulkReassignDialog
        open={reassignOpen}
        onOpenChange={setReassignOpen}
        jobIds={Array.from(assignedSelectedIds)}
        type={activeTab}
        onComplete={handleReassignComplete}
      />

      <BulkReassignDialog
        open={inProgressReassignOpen}
        onOpenChange={setInProgressReassignOpen}
        jobIds={Array.from(inProgressSelectedIds)}
        type={activeTab}
        onComplete={handleInProgressReassignComplete}
      />
    </div>
  );
}
