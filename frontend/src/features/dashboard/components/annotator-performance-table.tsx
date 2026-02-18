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
import { Separator } from "@/components/ui/separator";
import { Info } from "lucide-react";
import { TableSkeleton } from "@/components/table-skeleton";
import { DateRangePicker } from "@/components/date-range-picker";
import { useAnnotatorPerformance } from "../api/get-annotator-performance";
import type { AnnotatorPerformance } from "../api/dashboard-mapper";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
type SortKey = keyof AnnotatorPerformance | "pendingJobs";

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Uploaded",
  ASSIGNED_ANNOTATOR: "Assigned Annotator",
  ANNOTATION_IN_PROGRESS: "Annotation In Progress",
  SUBMITTED_FOR_QA: "Submitted for QA",
  ASSIGNED_QA: "Assigned QA",
  QA_IN_PROGRESS: "QA In Progress",
  QA_ACCEPTED: "QA Accepted",
  QA_REJECTED: "QA Rejected",
  DELIVERED: "Delivered",
  DISCARDED: "Discarded",
};

const STATUS_ORDER = [
  "UPLOADED",
  "ASSIGNED_ANNOTATOR",
  "ANNOTATION_IN_PROGRESS",
  "SUBMITTED_FOR_QA",
  "ASSIGNED_QA",
  "QA_IN_PROGRESS",
  "QA_ACCEPTED",
  "QA_REJECTED",
  "DELIVERED",
  "DISCARDED",
];

const COLUMN_FORMULAS = [
  {
    column: "Assigned",
    formula: "All jobs assigned to this annotator (all statuses except DISCARDED)",
    statuses: ["UPLOADED", "ASSIGNED_ANNOTATOR", "ANNOTATION_IN_PROGRESS", "SUBMITTED_FOR_QA", "ASSIGNED_QA", "QA_IN_PROGRESS", "QA_ACCEPTED", "QA_REJECTED", "DELIVERED"],
  },
  {
    column: "Completed",
    formula: "SUBMITTED_FOR_QA + ASSIGNED_QA + QA_IN_PROGRESS + QA_ACCEPTED + DELIVERED",
    statuses: ["SUBMITTED_FOR_QA", "ASSIGNED_QA", "QA_IN_PROGRESS", "QA_ACCEPTED", "DELIVERED"],
  },
  {
    column: "Pending",
    formula: "Assigned − Completed",
  },
  {
    column: "In Progress",
    formula: "ANNOTATION_IN_PROGRESS",
    statuses: ["ANNOTATION_IN_PROGRESS"],
  },
  {
    column: "QA Rejected",
    formula: "QA_REJECTED",
    statuses: ["QA_REJECTED"],
  },
  {
    column: "Delivered",
    formula: "DELIVERED",
    statuses: ["DELIVERED"],
  },
  {
    column: "Discarded",
    formula: "DISCARDED",
    statuses: ["DISCARDED"],
  },
  {
    column: "Acceptance %",
    formula: "DELIVERED / (DELIVERED + QA_REJECTED) × 100",
  },
];

export function AnnotatorPerformanceTable() {
  const [selectedAnnotator, setSelectedAnnotator] = useState<AnnotatorPerformance | null>(null);
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
    if (!data) return { assigned: 0, completed: 0, pending: 0, inProgress: 0, rejected: 0, discarded: 0 };
    return data.reduce(
      (acc, row) => ({
        assigned: acc.assigned + row.assignedJobs,
        completed: acc.completed + row.completedJobs,
        pending: acc.pending + (row.assignedJobs - row.completedJobs),
        inProgress: acc.inProgress + row.inProgressJobs,
        rejected: acc.rejected + row.rejectedJobs,
        discarded: acc.discarded + row.discardedJobs,
      }),
      { assigned: 0, completed: 0, pending: 0, inProgress: 0, rejected: 0, discarded: 0 },
    );
  }, [data]);

  function getSortValue(row: AnnotatorPerformance, key: SortKey): number | string | null {
    if (key === "pendingJobs") return row.assignedJobs - row.completedJobs;
    const val = row[key];
    if (typeof val === "object") return -1;
    return val ?? -1;
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
                      <dt className="font-semibold">QA Rejected</dt>
                      <dd className="text-muted-foreground">Jobs rejected by QA reviewer (status = QA_REJECTED).</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">Discarded</dt>
                      <dd className="text-muted-foreground">Jobs that were discarded (status = DISCARDED).</dd>
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
          <TableSkeleton columns={9} rows={3} />
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
                  onClick={() => handleSort("rejectedJobs")}
                >
                  <div>
                    QA Rejected
                    <SortIndicator col="rejectedJobs" />
                  </div>
                  <ColumnTotal value={totals.rejected} />
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer select-none"
                  onClick={() => handleSort("discardedJobs")}
                >
                  <div>
                    Discarded
                    <SortIndicator col="discardedJobs" />
                  </div>
                  <ColumnTotal value={totals.discarded} />
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
                    colSpan={9}
                    className="text-center text-muted-foreground h-24"
                  >
                    No annotators found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.slice(page * pageSize, (page + 1) * pageSize).map((row) => (
                  <TableRow
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedAnnotator(row)}
                  >
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
                      {row.rejectedJobs}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.discardedJobs}
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

      {/* Row detail dialog */}
      <Dialog
        open={selectedAnnotator !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedAnnotator(null);
        }}
      >
        <DialogContent className="sm:max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedAnnotator?.name} — Job Details</DialogTitle>
            <DialogDescription>
              Breakdown of job statuses and how each table column is derived.
            </DialogDescription>
          </DialogHeader>

          {selectedAnnotator && (() => {
            const bd = selectedAnnotator.statusBreakdown;

            function computeValue(f: typeof COLUMN_FORMULAS[number]): number | string {
              if (f.statuses) {
                return f.statuses.reduce((sum, s) => sum + (bd[s] ?? 0), 0);
              }
              if (f.column === "Pending") {
                const assigned = COLUMN_FORMULAS[0].statuses!.reduce((sum, s) => sum + (bd[s] ?? 0), 0);
                const completed = COLUMN_FORMULAS[1].statuses!.reduce((sum, s) => sum + (bd[s] ?? 0), 0);
                return assigned - completed;
              }
              if (f.column === "Acceptance %") {
                const delivered = bd["DELIVERED"] ?? 0;
                const rejected = bd["QA_REJECTED"] ?? 0;
                const total = delivered + rejected;
                return total > 0 ? `${((delivered / total) * 100).toFixed(1)}%` : "—";
              }
              return "—";
            }

            return (
              <div className="space-y-5">
                {/* Column Formulas */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Column Formulas</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Column</TableHead>
                        <TableHead>Formula / Statuses</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {COLUMN_FORMULAS.map((f) => (
                        <TableRow key={f.column}>
                          <TableCell className="font-medium">{f.column}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {f.formula}
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
                            {computeValue(f)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Separator />

                {/* Status Distribution */}
                <div>
                  <h4 className="text-sm font-semibold mb-2">Job Status Distribution</h4>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {STATUS_ORDER.map((status) => (
                            <TableHead key={status} className="text-right text-xs whitespace-nowrap">
                              {STATUS_LABELS[status]}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          {STATUS_ORDER.map((status) => (
                            <TableCell key={status} className="text-right tabular-nums">
                              {bd[status] ?? 0}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Total: {STATUS_ORDER.reduce((sum, s) => sum + (bd[s] ?? 0), 0)} jobs
                  </p>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
