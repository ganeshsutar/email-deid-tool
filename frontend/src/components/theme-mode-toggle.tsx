import { Sun, Moon, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTheme } from "@/lib/theme";

const MODE_CYCLE = ["light", "dark", "system"] as const;

const MODE_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

const MODE_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} as const;

export function ThemeModeToggle() {
  const { config, setMode } = useTheme();
  const Icon = MODE_ICONS[config.mode];

  function handleClick() {
    const currentIndex = MODE_CYCLE.indexOf(config.mode);
    const nextIndex = (currentIndex + 1) % MODE_CYCLE.length;
    setMode(MODE_CYCLE[nextIndex]);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleClick}
          >
            <Icon className="h-4 w-4" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Theme: {MODE_LABELS[config.mode]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
