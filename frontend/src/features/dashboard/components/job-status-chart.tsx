import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Download, Layers, BarChart3 } from "lucide-react";
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

const simpleChartConfig = {
  count: {
    label: "Jobs",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function JobStatusChart() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [stacked, setStacked] = useState(false);
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
          <div className="flex items-center gap-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => setStacked((v) => !v)}
                  >
                    {stacked ? (
                      <BarChart3 className="h-3.5 w-3.5" />
                    ) : (
                      <Layers className="h-3.5 w-3.5" />
                    )}
                    <span className="sr-only">
                      {stacked ? "Simple view" : "Stack by dataset"}
                    </span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {stacked ? "Switch to simple view" : "Stack by dataset"}
                </TooltipContent>
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
                <ScrollArea className="max-h-[200px]">
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
                <ScrollArea className="max-h-[200px]">
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
                </ScrollArea>
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
              <Bar
                dataKey="count"
                fill="var(--color-count)"
                radius={[4, 4, 0, 0]}
              />
            ) : null}
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
