import { useState, useMemo } from "react";
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
import { TableSkeleton } from "@/components/table-skeleton";
import { DateRangePicker } from "@/components/date-range-picker";
import { useQAPerformance } from "../api/get-qa-performance";
import type { QAPerformance } from "../api/dashboard-mapper";

type SortKey = keyof QAPerformance;
type ViewMode = "overview" | "review";

export function QAPerformanceTable() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [view, setView] = useState<ViewMode>("overview");
  const [sortKey, setSortKey] = useState<SortKey>("assignedJobs");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const dateParams = useMemo(
    () => ({
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
    }),
    [dateRange],
  );

  const { data, isLoading } = useQAPerformance(dateParams);

  function handleViewChange(value: string) {
    setView(value as ViewMode);
    setSortKey(value === "overview" ? "assignedJobs" : "reviewedJobs");
    setSortDir("desc");
  }

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => {
      const av = a[sortKey] ?? -1;
      const bv = b[sortKey] ?? -1;
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
          <TableSkeleton columns={6} rows={3} />
        ) : (
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
                      Assigned
                      <SortIndicator col="assignedJobs" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("completedJobs")}
                    >
                      Completed
                      <SortIndicator col="completedJobs" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("inReviewJobs")}
                    >
                      In Progress
                      <SortIndicator col="inReviewJobs" />
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
                      Reviewed
                      <SortIndicator col="reviewedJobs" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("acceptedJobs")}
                    >
                      Accepted
                      <SortIndicator col="acceptedJobs" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("rejectedJobs")}
                    >
                      Rejected
                      <SortIndicator col="rejectedJobs" />
                    </TableHead>
                    <TableHead
                      className="text-right cursor-pointer select-none"
                      onClick={() => handleSort("inReviewJobs")}
                    >
                      In Review
                      <SortIndicator col="inReviewJobs" />
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
                    colSpan={6}
                    className="text-center text-muted-foreground h-24"
                  >
                    No QA reviewers found
                  </TableCell>
                </TableRow>
              ) : (
                sorted.map((row) => (
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
        )}
      </CardContent>
    </Card>
  );
}
