import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { DataTablePagination } from "@/components/data-table-pagination";
import { TableSkeleton } from "@/components/table-skeleton";
import { useMyQAJobs } from "@/features/qa-review/api/get-my-qa-jobs";
import { useBlindReviewSetting } from "@/features/qa-review/api/get-blind-review-setting";
import { QAJobsSummaryBar } from "@/features/qa-review/components/qa-jobs-summary-bar";
import { MyQAJobsTable } from "@/features/qa-review/components/my-qa-jobs-table";
import { JobStatus } from "@/types/enums";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/qa/dashboard")({
  component: QADashboardPage,
});

const statusTabs = [
  { value: "", label: "All" },
  { value: JobStatus.ASSIGNED_QA, label: "QA Assigned" },
  { value: JobStatus.QA_IN_PROGRESS, label: "In Review" },
  { value: JobStatus.DELIVERED, label: "Accepted" },
  { value: JobStatus.QA_REJECTED, label: "Rejected" },
] as const;

function QADashboardPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: blindReview } = useBlindReviewSetting();

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

  const { data, isLoading } = useMyQAJobs({
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
    <div className="space-y-4 p-6" data-testid="qa-dashboard">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold tracking-tight lg:text-2xl">QA Review Jobs</h1>
        {blindReview?.enabled && (
          <Badge variant="secondary">Blind Review Active</Badge>
        )}
      </div>

      {data && (
        <QAJobsSummaryBar statusCounts={data.statusCounts} />
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
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                data-testid={`status-tab-${tab.label.toLowerCase().replace(/\s+/g, "-") || "all"}`}
              >
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
              data-testid="qa-jobs-search"
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
            <MyQAJobsTable jobs={data.results} />
          </div>
          <div data-testid="qa-jobs-pagination">
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
