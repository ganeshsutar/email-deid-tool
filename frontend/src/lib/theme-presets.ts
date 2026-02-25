import {
  NEUTRAL_SWATCH_COLORS,
  BASE_SWATCH_COLORS,
} from "./theme";
import type { ThemeConfig } from "./theme";

export interface ThemePresetInfo {
  name: string;
  description: string;
  config: Omit<ThemeConfig, "fontSize">;
  swatches: [string, string];
}

export const THEME_PRESETS: ThemePresetInfo[] = [
  {
    name: "Default",
    description: "Clean zinc + blue, balanced for everyday use",
    config: {
      style: "vega",
      neutralColor: "zinc",
      baseColor: "blue",
      radius: 0.5,
      mode: "light",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.zinc, BASE_SWATCH_COLORS.blue],
  },
  {
    name: "Warm Minimal",
    description: "Stone neutrals with soft orange accents",
    config: {
      style: "nova",
      neutralColor: "stone",
      baseColor: "orange",
      radius: 0.5,
      mode: "light",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.stone, BASE_SWATCH_COLORS.orange],
  },
  {
    name: "Cool Professional",
    description: "Slate tones with violet highlights",
    config: {
      style: "mira",
      neutralColor: "slate",
      baseColor: "violet",
      radius: 0.5,
      mode: "light",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.slate, BASE_SWATCH_COLORS.violet],
  },
  {
    name: "Midnight",
    description: "Dark zinc with blue accents, easy on the eyes",
    config: {
      style: "vega",
      neutralColor: "zinc",
      baseColor: "blue",
      radius: 0.5,
      mode: "dark",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.zinc, BASE_SWATCH_COLORS.blue],
  },
  {
    name: "Forest",
    description: "Dark stone with nature-inspired green",
    config: {
      style: "maia",
      neutralColor: "stone",
      baseColor: "green",
      radius: 1.0,
      mode: "dark",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.stone, BASE_SWATCH_COLORS.green],
  },
  {
    name: "Rose Quartz",
    description: "Soft neutral palette with rose accent",
    config: {
      style: "maia",
      neutralColor: "neutral",
      baseColor: "rose",
      radius: 1.0,
      mode: "light",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.neutral, BASE_SWATCH_COLORS.rose],
  },
  {
    name: "Dark Hacker",
    description: "Monospace font, sharp corners, green on dark",
    config: {
      style: "lyra",
      neutralColor: "gray",
      baseColor: "green",
      radius: 0,
      mode: "dark",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.gray, BASE_SWATCH_COLORS.green],
  },
  {
    name: "Sunset",
    description: "Warm tones with a golden yellow accent",
    config: {
      style: "nova",
      neutralColor: "stone",
      baseColor: "yellow",
      radius: 0.75,
      mode: "light",
    },
    swatches: [NEUTRAL_SWATCH_COLORS.stone, BASE_SWATCH_COLORS.yellow],
  },
];
