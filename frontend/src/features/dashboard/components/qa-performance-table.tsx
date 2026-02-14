import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TableSkeleton } from "@/components/table-skeleton";
import { DateRangePicker } from "@/components/date-range-picker";
import { useQAPerformance } from "../api/get-qa-performance";
import type { QAPerformance } from "../api/dashboard-mapper";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type SortKey = keyof QAPerformance | "pendingJobs";
type ViewMode = "overview" | "review";

export function QAPerformanceTable() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [view, setView] = useState<ViewMode>("overview");
  const [sortKey, setSortKey] = useState<SortKey>("assignedJobs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(0);
  }, [sortKey, sortDir, dateRange, view, pageSize]);

  const dateParams = useMemo(
    () => ({
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    }),
    [dateRange],
  );

  const { data, isLoading } = useQAPerformance(dateParams);

  const totals = useMemo(() => {
    if (!data) return {
      assigned: 0, completed: 0, pending: 0, inReview: 0,
      reviewed: 0, accepted: 0, rejected: 0,
    };
    return data.reduce(
      (acc, row) => ({
        assigned: acc.assigned + row.assignedJobs,
        completed: acc.completed + row.completedJobs,
        pending: acc.pending + (row.assignedJobs - row.completedJobs),
        inReview: acc.inReview + row.inReviewJobs,
        reviewed: acc.reviewed + row.reviewedJobs,
        accepted: acc.accepted + row.acceptedJobs,
        rejected: acc.rejected + row.rejectedJobs,
      }),
      { assigned: 0, completed: 0, pending: 0, inReview: 0, reviewed: 0, accepted: 0, rejected: 0 },
    );
  }, [data]);

  function handleViewChange(value: string) {
    setView(value as ViewMode);
    setSortKey(value === "overview" ? "assignedJobs" : "reviewedJobs");
    setSortDir("desc");
  }

  function getSortValue(row: QAPerformance, key: SortKey): number | string | null {
    if (key === "pendingJobs") return row.assignedJobs - row.completedJobs;
    return row[key] ?? -1;
  }

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = getSortValue(a, sortKey) ?? -1;
      const bv = getSortValue(b, sortKey) ?? -1;
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  function SortIndicator({ col }: { col: SortKey }) {
    if (col !== sortKey) return null;
    return <span className="ml-1">{sortDir === "asc" ? "\u2191" : "\u2193"}</span>;
  }

  function ColumnTotal({ value }: { value: number }) {
    return (
      <div className="text-xs text-muted-foreground font-normal tabular-nums">
        {value.toLocaleString()}
      </div>
    );
  }

  const overviewColCount = 7;
  const reviewColCount = 6;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle>QA Performance</CardTitle>
            <CardDescription>Metrics for active QA reviewers</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DateRangePicker
              dateRange={dateRange}
              onDateRangeChange={setDateRange}
            />
            <Tabs value={view} onValueChange={handleViewChange}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="review">Review Details</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <TableSkeleton columns={view === "overview" ? overviewColCount : reviewColCount} rows={3} />
        ) : (
          <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer select-none"
                  onClick={() => handleSort("name")}
                >
                  Name
                  <SortIndicator col="name" />
                </TableHead>
                {view === "overview" ? (
                  <>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("assignedJobs")}
                    >
                      <div>
                        Assigned
                        <SortIndicator col="assignedJobs" />
                      </div>
                      <ColumnTotal value={totals.assigned} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("completedJobs")}
                    >
                      <div>
                        Completed
                        <SortIndicator col="completedJobs" />
                      </div>
                      <ColumnTotal value={totals.completed} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("pendingJobs")}
                    >
                      <div>
                        Pending
                        <SortIndicator col="pendingJobs" />
                      </div>
                      <ColumnTotal value={totals.pending} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("inReviewJobs")}
                    >
                      <div>
                        In Progress
                        <SortIndicator col="inReviewJobs" />
                      </div>
                      <ColumnTotal value={totals.inReview} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("acceptanceRate")}
                    >
                      Acceptance %
                      <SortIndicator col="acceptanceRate" />
                    </TableHead>
                    <TableHead className="text-right">Avg Ann/Job</TableHead>
                  </>
                ) : (
                  <>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("reviewedJobs")}
                    >
                      <div>
                        Reviewed
                        <SortIndicator col="reviewedJobs" />
                      </div>
                      <ColumnTotal value={totals.reviewed} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("acceptedJobs")}
                    >
                      <div>
                        Accepted
                        <SortIndicator col="acceptedJobs" />
                      </div>
                      <ColumnTotal value={totals.accepted} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("rejectedJobs")}
                    >
                      <div>
                        Rejected
                        <SortIndicator col="rejectedJobs" />
                      </div>
                      <ColumnTotal value={totals.rejected} />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("inReviewJobs")}
                    >
                      <div>
                        In Review
                        <SortIndicator col="inReviewJobs" />
                      </div>
                      <ColumnTotal value={totals.inReview} />
                    </TableHead>
                    <TableHead className="text-right">Avg Review Time</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={view === "overview" ? overviewColCount : reviewColCount}
                    className="text-center text-muted-foreground h-24"
                  >
                    No QA reviewers found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    {view === "overview" ? (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {row.assignedJobs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.completedJobs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.assignedJobs - row.completedJobs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.inReviewJobs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.acceptanceRate != null
                            ? `${row.acceptanceRate}%`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          —
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="text-right tabular-nums">
                          {row.reviewedJobs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.acceptedJobs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.rejectedJobs}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {row.inReviewJobs}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {row.avgReviewTime ?? "—"}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          {sorted.length > 0 && (() => {
            const totalPages = Math.ceil(sorted.length / pageSize);
            return (
              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Rows per page</span>
                  <Select
                    value={String(pageSize)}
                    onValueChange={(v) => setPageSize(Number(v))}
                  >
                    <SelectTrigger className="h-8 w-[70px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground mr-2">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(0)}
                    disabled={page === 0}
                  >
                    &laquo;
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 0}
                  >
                    &lsaquo;
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page + 1 >= totalPages}
                  >
                    &rsaquo;
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setPage(totalPages - 1)}
                    disabled={page + 1 >= totalPages}
                  >
                    &raquo;
                  </Button>
                </div>
              </div>
            );
          })()}
          </>
        )}
      </CardContent>
    </Card>
  );
}
