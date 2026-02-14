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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { DateRangePicker } from "@/components/date-range-picker";
import { useAnnotatorPerformance } from "../api/get-annotator-performance";
import type { AnnotatorPerformance } from "../api/dashboard-mapper";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type SortKey = keyof AnnotatorPerformance | "pendingJobs";

export function AnnotatorPerformanceTable() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [sortKey, setSortKey] = useState<SortKey>("completedJobs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(0);
  }, [sortKey, sortDir, dateRange, pageSize]);

  const dateParams = useMemo(
    () => ({
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    }),
    [dateRange],
  );

  const { data, isLoading } = useAnnotatorPerformance(dateParams);

  const totals = useMemo(() => {
    if (!data) return { assigned: 0, completed: 0, pending: 0, inProgress: 0 };
    return data.reduce(
      (acc, row) => ({
        assigned: acc.assigned + row.assignedJobs,
        completed: acc.completed + row.completedJobs,
        pending: acc.pending + (row.assignedJobs - row.completedJobs),
        inProgress: acc.inProgress + row.inProgressJobs,
      }),
      { assigned: 0, completed: 0, pending: 0, inProgress: 0 },
    );
  }, [data]);

  function getSortValue(row: AnnotatorPerformance, key: SortKey): number | string | null {
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1">
              <CardTitle>Annotator Performance</CardTitle>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Annotator Performance Columns</DialogTitle>
                    <DialogDescription>
                      Explanation of each column in the annotator performance table.
                    </DialogDescription>
                  </DialogHeader>
                  <dl className="space-y-3 text-sm">
                    <div>
                      <dt className="font-semibold">Name</dt>
                      <dd className="text-muted-foreground">Annotator's display name.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Assigned</dt>
                      <dd className="text-muted-foreground">Total jobs assigned to the annotator.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Completed</dt>
                      <dd className="text-muted-foreground">Jobs that have progressed past annotation (submitted for QA, in QA, accepted, or delivered).</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Pending</dt>
                      <dd className="text-muted-foreground">Assigned minus Completed.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">In Progress</dt>
                      <dd className="text-muted-foreground">Jobs currently being annotated (status = ANNOTATION_IN_PROGRESS).</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Acceptance %</dt>
                      <dd className="text-muted-foreground">(Delivered Jobs / (Delivered + QA Rejected)) × 100 — percentage of completed jobs that passed QA.</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Avg Ann/Job</dt>
                      <dd className="text-muted-foreground">Average number of annotations per job (not yet implemented).</dd>
                    </div>
                  </dl>
                </DialogContent>
              </Dialog>
            </div>
            <CardDescription>Metrics for active annotators</CardDescription>
          </div>
          <DateRangePicker
            dateRange={dateRange}
            onDateRangeChange={setDateRange}
          />
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {isLoading ? (
          <TableSkeleton columns={7} rows={3} />
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
                  onClick={() => handleSort("inProgressJobs")}
                >
                  <div>
                    In Progress
                    <SortIndicator col="inProgressJobs" />
                  </div>
                  <ColumnTotal value={totals.inProgress} />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("acceptanceRate")}
                >
                  Acceptance %
                  <SortIndicator col="acceptanceRate" />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("avgAnnotationsPerJob")}
                >
                  Avg Ann/Job
                  <SortIndicator col="avgAnnotationsPerJob" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center text-muted-foreground h-24"
                  >
                    No annotators found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.name}</TableCell>
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
                      {row.inProgressJobs}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.acceptanceRate != null
                        ? `${row.acceptanceRate}%`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.avgAnnotationsPerJob ?? "—"}
                    </TableCell>
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
