import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Download, Layers, BarChart3, PieChartIcon, TableIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  useJobStatusCounts,
  useJobStatusCountsByDataset,
} from "@/features/dashboard/api/get-job-status-counts";
import { useDatasetOptions } from "@/features/dashboard/api/get-dataset-options";
import { downloadJobCsv } from "@/features/dashboard/api/download-job-csv";
import { cn } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  UPLOADED: "Uploaded",
  ASSIGNED_ANNOTATOR: "Assigned",
  ANNOTATION_IN_PROGRESS: "Annotating",
  SUBMITTED_FOR_QA: "Submitted",
  ASSIGNED_QA: "QA Assigned",
  QA_IN_PROGRESS: "In QA",
  QA_REJECTED: "Rejected",
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
  "QA_REJECTED",
  "DELIVERED",
  "DISCARDED",
];

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const STATUS_COLORS: Record<string, string> = {
  UPLOADED: "hsl(215 15% 60%)",
  ASSIGNED_ANNOTATOR: "hsl(210 80% 55%)",
  ANNOTATION_IN_PROGRESS: "hsl(40 90% 50%)",
  SUBMITTED_FOR_QA: "hsl(170 60% 45%)",
  ASSIGNED_QA: "hsl(260 60% 55%)",
  QA_IN_PROGRESS: "hsl(280 60% 55%)",
  QA_REJECTED: "hsl(0 75% 55%)",
  DELIVERED: "hsl(145 65% 42%)",
  DISCARDED: "hsl(0 0% 55%)",
};

const simpleChartConfig: ChartConfig = {
  count: {
    label: "Jobs",
    color: "var(--chart-1)",
  },
  ...Object.fromEntries(
    STATUS_ORDER.map((status) => [
      STATUS_LABELS[status] ?? status,
      { label: STATUS_LABELS[status] ?? status, color: STATUS_COLORS[status] },
    ]),
  ),
};

export function JobStatusChart() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  type ViewMode = "simple" | "stacked" | "pie" | "table";
  const [viewMode, setViewMode] = useState<ViewMode>("simple");
  const stacked = viewMode === "stacked";
  const { data: datasets } = useDatasetOptions();

  const queryParams =
    selectedIds.length > 0 ? { datasetIds: selectedIds } : {};
  const { data: statusCounts } = useJobStatusCounts(queryParams);
  const { data: byDatasetCounts } = useJobStatusCountsByDataset(
    queryParams,
    stacked,
  );

  // Simple (non-stacked) chart data
  const simpleData = useMemo(() => {
    if (!statusCounts) return [];
    const allData = STATUS_ORDER.map((status) => ({
      status: STATUS_LABELS[status] ?? status,
      statusKey: status,
      count: statusCounts[status] ?? 0,
    }));
    if (selectedStatuses.length === 0) return allData;
    return allData.filter((d) => selectedStatuses.includes(d.statusKey));
  }, [statusCounts, selectedStatuses]);

  // Stacked chart data + config
  const { stackedData, stackedConfig, datasetNames } = useMemo(() => {
    if (!byDatasetCounts || byDatasetCounts.length === 0) {
      return { stackedData: [], stackedConfig: {} as ChartConfig, datasetNames: [] as string[] };
    }

    // Collect unique dataset names in order
    const names: string[] = [];
    for (const item of byDatasetCounts) {
      if (!names.includes(item.dataset_name)) {
        names.push(item.dataset_name);
      }
    }

    // Build rows: one per status (filtered by selectedStatuses)
    const filteredStatuses = selectedStatuses.length > 0
      ? STATUS_ORDER.filter((s) => selectedStatuses.includes(s))
      : STATUS_ORDER;
    const rows = filteredStatuses.map((status) => {
      const row: Record<string, string | number> = {
        status: STATUS_LABELS[status] ?? status,
        statusKey: status,
      };
      for (const name of names) {
        row[name] = 0;
      }
      for (const item of byDatasetCounts) {
        if (item.status === status) {
          row[item.dataset_name] = item.count;
        }
      }
      return row;
    });

    // Build chart config
    const config: ChartConfig = {};
    for (let i = 0; i < names.length; i++) {
      config[names[i]] = {
        label: names[i],
        color: CHART_COLORS[i % CHART_COLORS.length],
      };
    }

    return { stackedData: rows, stackedConfig: config, datasetNames: names };
  }, [byDatasetCounts, selectedStatuses]);

  const data = stacked ? stackedData : simpleData;

  const nonZeroStatuses = useMemo(
    () => simpleData.filter((d) => d.count > 0),
    [simpleData],
  );

  const toggleDataset = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((prev) =>
      prev.includes(status) ? prev.filter((v) => v !== status) : [...prev, status],
    );
  };

  const statusLabel = useMemo(() => {
    if (selectedStatuses.length === 0) return "All Statuses";
    if (selectedStatuses.length === 1) {
      return STATUS_LABELS[selectedStatuses[0]] ?? selectedStatuses[0];
    }
    return `${selectedStatuses.length} Statuses`;
  }, [selectedStatuses]);

  const datasetLabel = useMemo(() => {
    if (selectedIds.length === 0) return "All Datasets";
    if (selectedIds.length === 1) {
      const ds = datasets?.find((d) => d.id === selectedIds[0]);
      return ds?.name ?? "1 Dataset";
    }
    return `${selectedIds.length} Datasets`;
  }, [selectedIds, datasets]);

  const handleDownload = async (status?: string) => {
    try {
      await downloadJobCsv({
        status,
        datasetIds: selectedIds.length > 0 ? selectedIds : undefined,
      });
      toast.success("CSV downloaded successfully");
    } catch {
      toast.error("Failed to download CSV");
    }
  };

  const activeConfig = stacked ? stackedConfig : simpleChartConfig;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Status Distribution</CardTitle>
        <CardDescription>Current count of jobs by status</CardDescription>
        <CardAction>
          <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "simple" ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode("simple")}
                  >
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span className="sr-only">Simple view</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Simple view</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "stacked" ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode("stacked")}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    <span className="sr-only">Stack by dataset</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Stack by dataset</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "pie" ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode("pie")}
                  >
                    <PieChartIcon className="h-3.5 w-3.5" />
                    <span className="sr-only">Donut chart</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Donut chart</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={viewMode === "table" ? "default" : "outline"}
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setViewMode("table")}
                  >
                    <TableIcon className="h-3.5 w-3.5" />
                    <span className="sr-only">Table view</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Table view</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-[140px] justify-between"
                >
                  <span className="truncate">{statusLabel}</span>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="end">
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent",
                    selectedStatuses.length === 0 && "text-primary font-medium",
                  )}
                  onClick={() => setSelectedStatuses([])}
                >
                  {selectedStatuses.length === 0 && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span
                    className={cn(selectedStatuses.length > 0 && "ml-[22px]")}
                  >
                    All Statuses
                  </span>
                </div>
                <div className="border-t" />
                <ScrollArea className="h-[240px]">
                  {STATUS_ORDER.map((status) => (
                    <label
                      key={status}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedStatuses.includes(status)}
                        onCheckedChange={() => toggleStatus(status)}
                      />
                      <span className="text-sm truncate">
                        {STATUS_LABELS[status] ?? status}
                      </span>
                    </label>
                  ))}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-[160px] justify-between"
                >
                  <span className="truncate">{datasetLabel}</span>
                  <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[200px] p-0" align="end">
                <div
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent",
                    selectedIds.length === 0 && "text-primary font-medium",
                  )}
                  onClick={() => setSelectedIds([])}
                >
                  {selectedIds.length === 0 && (
                    <Check className="h-3.5 w-3.5" />
                  )}
                  <span
                    className={cn(selectedIds.length > 0 && "ml-[22px]")}
                  >
                    All Datasets
                  </span>
                </div>
                <div className="border-t" />
                <div className="max-h-[200px] overflow-y-auto">
                  {datasets?.map((d) => (
                    <label
                      key={d.id}
                      className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedIds.includes(d.id)}
                        onCheckedChange={() => toggleDataset(d.id)}
                      />
                      <span className="text-sm truncate">{d.name}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 w-8 p-0"
                  disabled={nonZeroStatuses.length === 0}
                >
                  <Download className="h-3.5 w-3.5" />
                  <span className="sr-only">Download CSV</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  Download CSV — {datasetLabel}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleDownload(undefined)}
                >
                  All Statuses
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {nonZeroStatuses.map((item) => (
                  <DropdownMenuItem
                    key={item.statusKey}
                    onClick={() => handleDownload(item.statusKey)}
                  >
                    {item.status} ({item.count})
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {simpleData.length > 0 && simpleData.every((d) => d.count === 0) ? (
          <EmptyState
            icon={BarChart3}
            title="No jobs yet"
            description="Job status distribution will appear here once jobs are created."
          />
        ) : viewMode === "table" ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Count</TableHead>
                <TableHead className="w-[40%]">Distribution</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {simpleData.map((d) => {
                const total = simpleData.reduce((s, r) => s + r.count, 0);
                const pct = total > 0 ? (d.count / total) * 100 : 0;
                return (
                  <TableRow key={d.statusKey}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: STATUS_COLORS[d.statusKey] }}
                        />
                        {d.status}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {d.count.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: STATUS_COLORS[d.statusKey],
                            }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
                          {Math.round(pct)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-medium">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">
                  {simpleData.reduce((s, r) => s + r.count, 0).toLocaleString()}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        ) : viewMode === "pie" ? (
          <ChartContainer config={simpleChartConfig} className="w-full h-[300px]">
            <PieChart>
              <ChartTooltip content={<ChartTooltipContent />} />
              <Pie
                data={simpleData.filter((d) => d.count > 0)}
                dataKey="count"
                nameKey="status"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={110}
                label={({ status, count }) => `${status}: ${count}`}
              >
                {simpleData
                  .filter((d) => d.count > 0)
                  .map((entry) => (
                    <Cell
                      key={entry.statusKey}
                      fill={STATUS_COLORS[entry.statusKey] ?? "var(--chart-1)"}
                    />
                  ))}
              </Pie>
              <Legend />
            </PieChart>
          </ChartContainer>
        ) : (
          <ChartContainer config={activeConfig} className={cn("w-full", stacked ? "h-[340px]" : "h-[300px]")}>
            <BarChart
              data={data}
              margin={{ left: 10, right: 10, bottom: 40 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="status"
                type="category"
                tickLine={false}
                axisLine={false}
                fontSize={12}
                angle={-45}
                textAnchor="end"
              />
              <YAxis type="number" />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent />}
              />
              {stacked
                ? datasetNames.map((name, i) => (
                    <Bar
                      key={name}
                      dataKey={name}
                      stackId="a"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                      radius={
                        i === datasetNames.length - 1
                          ? [4, 4, 0, 0]
                          : [0, 0, 0, 0]
                      }
                    />
                  ))
                : null}
              {stacked ? (
                <Legend
                  verticalAlign="top"
                  align="center"
                  wrapperStyle={{ paddingBottom: 8 }}
                />
              ) : null}
              {!stacked ? (
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {simpleData.map((entry) => (
                    <Cell
                      key={entry.statusKey}
                      fill={STATUS_COLORS[entry.statusKey] ?? "var(--chart-1)"}
                    />
                  ))}
                </Bar>
              ) : null}
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
