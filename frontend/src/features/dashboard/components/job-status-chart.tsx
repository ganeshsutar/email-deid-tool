import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Check, ChevronsUpDown, Download } from "lucide-react";
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
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { useJobStatusCounts } from "@/features/dashboard/api/get-job-status-counts";
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
  QA_ACCEPTED: "Accepted",
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
  "QA_ACCEPTED",
  "DELIVERED",
  "DISCARDED",
];

const chartConfig = {
  count: {
    label: "Jobs",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig;

export function JobStatusChart() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { data: datasets } = useDatasetOptions();
  const { data: statusCounts } = useJobStatusCounts(
    selectedIds.length > 0 ? { datasetIds: selectedIds } : {},
  );

  const data = useMemo(() => {
    if (!statusCounts) return [];
    return STATUS_ORDER.map((status) => ({
      status: STATUS_LABELS[status] ?? status,
      statusKey: status,
      count: statusCounts[status] ?? 0,
    }));
  }, [statusCounts]);

  const nonZeroStatuses = useMemo(
    () => data.filter((d) => d.count > 0),
    [data],
  );

  const toggleDataset = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  };

  const datasetLabel = useMemo(() => {
    if (selectedIds.length === 0) return "All Datasets";
    if (selectedIds.length === 1) {
      const ds = datasets?.find((d) => d.id === selectedIds[0]);
      return ds?.name ?? "1 Dataset";
    }
    return `${selectedIds.length} Datasets`;
  }, [selectedIds, datasets]);

  const handleDownload = async (status: string) => {
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Status Distribution</CardTitle>
        <CardDescription>Current count of jobs by status</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
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
        <ChartContainer config={chartConfig} className="h-[300px] w-full">
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
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
