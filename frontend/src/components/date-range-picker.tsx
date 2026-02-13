import { useState } from "react";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
}

const presets = [
  {
    label: "Today",
    range: (): DateRange => ({
      from: new Date(),
      to: new Date(),
    }),
  },
  {
    label: "Yesterday",
    range: (): DateRange => ({
      from: subDays(new Date(), 1),
      to: subDays(new Date(), 1),
    }),
  },
  {
    label: "Last 2 days",
    range: (): DateRange => ({
      from: subDays(new Date(), 1),
      to: new Date(),
    }),
  },
  {
    label: "Last 3 days",
    range: (): DateRange => ({
      from: subDays(new Date(), 2),
      to: new Date(),
    }),
  },
  {
    label: "Last 7 days",
    range: (): DateRange => ({
      from: subDays(new Date(), 6),
      to: new Date(),
    }),
  },
  {
    label: "Last 14 days",
    range: (): DateRange => ({
      from: subDays(new Date(), 13),
      to: new Date(),
    }),
  },
  {
    label: "Last 30 days",
    range: (): DateRange => ({
      from: subDays(new Date(), 29),
      to: new Date(),
    }),
  },
  {
    label: "This month",
    range: (): DateRange => ({
      from: startOfMonth(new Date()),
      to: new Date(),
    }),
  },
  {
    label: "Last month",
    range: (): DateRange => {
      const lastMonth = subMonths(new Date(), 1);
      return {
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      };
    },
  },
] as const;

export function DateRangePicker({
  dateRange,
  onDateRangeChange,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const label =
    dateRange?.from && dateRange?.to
      ? `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`
      : dateRange?.from
        ? `${format(dateRange.from, "MMM d, yyyy")} -`
        : "All time";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs font-normal",
            !dateRange && "text-muted-foreground",
          )}
        >
          <CalendarIcon className="size-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          <div className="flex flex-col gap-1 border-r p-3">
            {presets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                size="sm"
                className="justify-start text-xs"
                onClick={() => {
                  onDateRangeChange(preset.range());
                  setOpen(false);
                }}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="justify-start text-xs"
              onClick={() => {
                onDateRangeChange(undefined);
                setOpen(false);
              }}
            >
              All time
            </Button>
          </div>
          <div className="p-3">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                onDateRangeChange(range);
                if (range?.from && range?.to) {
                  setOpen(false);
                }
              }}
              disabled={{ after: new Date() }}
              numberOfMonths={1}
              defaultMonth={dateRange?.from}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
