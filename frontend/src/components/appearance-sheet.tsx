import { Sun, Moon, Monitor, RotateCcw } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import {
  useTheme,
  RADIUS_OPTIONS,
  NEUTRAL_SWATCH_COLORS,
  BASE_SWATCH_COLORS,
  NeutralColor,
  BaseColor,
  StylePreset,
  ThemeMode,
  FontSize,
  FONT_SIZE_SCALE,
  STYLE_FONTS,
} from "@/lib/theme";
import type { ThemeConfig } from "@/lib/theme";
import { THEME_PRESETS } from "@/lib/theme-presets";
import type { ThemePresetInfo } from "@/lib/theme-presets";
import { cn } from "@/lib/utils";

interface AppearanceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const STYLE_DESCRIPTIONS: Record<StylePreset, string> = {
  vega: "Geist Sans",
  nova: "Inter",
  maia: "Nunito Sans",
  lyra: "JetBrains Mono",
  mira: "DM Sans",
};

const NEUTRAL_OPTIONS = Object.values(NeutralColor);
const BASE_OPTIONS = Object.values(BaseColor);
const STYLE_OPTIONS = Object.values(StylePreset);
const FONT_SIZE_OPTIONS = Object.values(FontSize);

const FONT_SIZE_LABELS: Record<FontSize, string> = {
  small: "S",
  default: "M",
  large: "L",
  "x-large": "XL",
};

function isMatchingPreset(
  current: ThemeConfig,
  preset: Omit<ThemeConfig, "fontSize">
): boolean {
  return (
    current.style === preset.style &&
    current.neutralColor === preset.neutralColor &&
    current.baseColor === preset.baseColor &&
    current.radius === preset.radius &&
    current.mode === preset.mode
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-medium text-muted-foreground mb-3">
      {children}
    </h3>
  );
}

function PresetCard({
  preset,
  isActive,
  onClick,
}: {
  preset: ThemePresetInfo;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-accent/50",
        isActive && "border-primary bg-accent/50"
      )}
    >
      <div className="flex shrink-0 gap-1 mt-0.5">
        {preset.swatches.map((color, i) => (
          <span
            key={i}
            className="h-4 w-4 rounded-full border border-border/50"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium leading-tight">{preset.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
          {preset.description}
        </p>
      </div>
    </button>
  );
}

function StyleCard({
  style,
  isActive,
  onClick,
}: {
  style: StylePreset;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent/50",
        isActive && "border-primary bg-accent/50"
      )}
    >
      <span
        className="text-lg font-semibold shrink-0 w-8"
        style={{ fontFamily: STYLE_FONTS[style] }}
      >
        Aa
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium capitalize">{style}</p>
        <p className="text-xs text-muted-foreground">
          {STYLE_DESCRIPTIONS[style]}
        </p>
      </div>
    </button>
  );
}

function ColorSwatch({
  color,
  isActive,
  onClick,
  label,
}: {
  color: string;
  isActive: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        "h-8 w-8 rounded-full border-2 transition-all",
        isActive
          ? "border-primary ring-2 ring-primary/30 scale-110"
          : "border-transparent hover:scale-110"
      )}
      style={{ backgroundColor: color }}
    />
  );
}

export function AppearanceSheet({ open, onOpenChange }: AppearanceSheetProps) {
  const {
    config,
    setStyle,
    setNeutralColor,
    setBaseColor,
    setRadius,
    setMode,
    setFontSize,
    applyPreset,
    resetTheme,
  } = useTheme();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md p-0">
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle>Appearance</SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)] px-6 pb-6">
          <div className="space-y-6 py-4">
            {/* Presets */}
            <section>
              <SectionLabel>Presets</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                {THEME_PRESETS.map((preset) => (
                  <PresetCard
                    key={preset.name}
                    preset={preset}
                    isActive={isMatchingPreset(config, preset.config)}
                    onClick={() => applyPreset(preset.config)}
                  />
                ))}
              </div>
            </section>

            {/* Mode */}
            <section>
              <SectionLabel>Mode</SectionLabel>
              <ToggleGroup
                type="single"
                value={config.mode}
                onValueChange={(v) => v && setMode(v as ThemeMode)}
                className="justify-start"
              >
                <ToggleGroupItem value="light" aria-label="Light mode" className="gap-1.5">
                  <Sun className="h-4 w-4" />
                  Light
                </ToggleGroupItem>
                <ToggleGroupItem value="dark" aria-label="Dark mode" className="gap-1.5">
                  <Moon className="h-4 w-4" />
                  Dark
                </ToggleGroupItem>
                <ToggleGroupItem value="system" aria-label="System mode" className="gap-1.5">
                  <Monitor className="h-4 w-4" />
                  System
                </ToggleGroupItem>
              </ToggleGroup>
            </section>

            {/* Style */}
            <section>
              <SectionLabel>Style</SectionLabel>
              <div className="grid grid-cols-1 gap-2">
                {STYLE_OPTIONS.map((style) => (
                  <StyleCard
                    key={style}
                    style={style}
                    isActive={config.style === style}
                    onClick={() => setStyle(style)}
                  />
                ))}
              </div>
            </section>

            {/* Accent Color */}
            <section>
              <SectionLabel>Accent Color</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {BASE_OPTIONS.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={BASE_SWATCH_COLORS[color]}
                    isActive={config.baseColor === color}
                    onClick={() => setBaseColor(color)}
                    label={color}
                  />
                ))}
              </div>
            </section>

            {/* Neutral Color */}
            <section>
              <SectionLabel>Neutral Color</SectionLabel>
              <div className="flex flex-wrap gap-2">
                {NEUTRAL_OPTIONS.map((color) => (
                  <ColorSwatch
                    key={color}
                    color={NEUTRAL_SWATCH_COLORS[color]}
                    isActive={config.neutralColor === color}
                    onClick={() => setNeutralColor(color)}
                    label={color}
                  />
                ))}
              </div>
            </section>

            {/* Radius */}
            <section>
              <SectionLabel>Radius</SectionLabel>
              <ToggleGroup
                type="single"
                value={String(config.radius)}
                onValueChange={(v) => v && setRadius(Number(v))}
                className="justify-start"
              >
                {RADIUS_OPTIONS.map((r) => (
                  <ToggleGroupItem key={r} value={String(r)} aria-label={`Radius ${r}`}>
                    {r}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </section>

            {/* Font Size */}
            <section>
              <SectionLabel>Font Size</SectionLabel>
              <ToggleGroup
                type="single"
                value={config.fontSize}
                onValueChange={(v) => v && setFontSize(v as FontSize)}
                className="justify-start"
              >
                {FONT_SIZE_OPTIONS.map((size) => (
                  <ToggleGroupItem
                    key={size}
                    value={size}
                    aria-label={`Font size ${size}`}
                    className="gap-1"
                  >
                    <span style={{ fontSize: `${FONT_SIZE_SCALE[size]}rem` }}>
                      {FONT_SIZE_LABELS[size]}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </section>

            {/* Reset */}
            <Button
              variant="outline"
              onClick={resetTheme}
              className="w-full"
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Default
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
