import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { DataTablePagination } from "@/components/data-table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useMyAnnotationJobs } from "@/features/annotations/api/get-my-annotation-jobs";
import { JobsSummaryBar } from "@/features/annotations/components/jobs-summary-bar";
import { MyJobsTable } from "@/features/annotations/components/my-jobs-table";
import { JobStatus } from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/annotator/dashboard")({
  component: AnnotatorDashboardPage,
});

const statusTabs = [
  { value: "", label: "All" },
  { value: JobStatus.ASSIGNED_ANNOTATOR, label: "Assigned" },
  { value: JobStatus.ANNOTATION_IN_PROGRESS, label: "In Progress" },
  { value: JobStatus.SUBMITTED_FOR_QA, label: "Submitted" },
  { value: `${JobStatus.ASSIGNED_QA},${JobStatus.QA_IN_PROGRESS}`, label: "In QA" },
  { value: JobStatus.QA_REJECTED, label: "Rejected" },
  { value: JobStatus.DELIVERED, label: "Delivered" },
] as const;

function AnnotatorDashboardPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Keyboard shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const { data, isLoading } = useMyAnnotationJobs({
    page,
    pageSize,
    status: statusFilter || undefined,
    search: search || undefined,
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <div className="space-y-4 p-6" data-testid="annotator-dashboard">
      <h1 className="text-xl font-bold tracking-tight lg:text-2xl">My Annotation Jobs</h1>

      {data && (
        <JobsSummaryBar statusCounts={data.statusCounts} />
      )}

      <div className="flex items-center gap-4 flex-wrap">
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <TabsList>
            {statusTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} data-testid={`status-tab-${tab.label.toLowerCase().replace(/\s+/g, "-")}`}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        <form onSubmit={handleSearch} className="flex gap-2 max-w-sm">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchRef}
              placeholder="Search by file name... (/)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9"
              data-testid="jobs-search"
            />
          </div>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </form>
      </div>

      {isLoading ? (
        <div className="rounded-lg border">
          <TableSkeleton rows={8} columns={5} />
        </div>
      ) : data ? (
        <>
          <div className="rounded-lg border">
            <MyJobsTable jobs={data.results} />
          </div>
          <div data-testid="jobs-pagination">
            <DataTablePagination
              page={page}
              pageSize={pageSize}
              totalCount={data.count}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
