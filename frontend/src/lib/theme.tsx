import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types (const objects, no enums per TS 5.9 erasableSyntaxOnly)
// ---------------------------------------------------------------------------

export const ThemeMode = {
  LIGHT: "light",
  DARK: "dark",
  SYSTEM: "system",
} as const;
export type ThemeMode = (typeof ThemeMode)[keyof typeof ThemeMode];

export const StylePreset = {
  VEGA: "vega",
  NOVA: "nova",
  MAIA: "maia",
  LYRA: "lyra",
  MIRA: "mira",
} as const;
export type StylePreset = (typeof StylePreset)[keyof typeof StylePreset];

export const NeutralColor = {
  NEUTRAL: "neutral",
  STONE: "stone",
  ZINC: "zinc",
  GRAY: "gray",
  SLATE: "slate",
} as const;
export type NeutralColor = (typeof NeutralColor)[keyof typeof NeutralColor];

export const BaseColor = {
  BLUE: "blue",
  GREEN: "green",
  ORANGE: "orange",
  RED: "red",
  ROSE: "rose",
  VIOLET: "violet",
  YELLOW: "yellow",
} as const;
export type BaseColor = (typeof BaseColor)[keyof typeof BaseColor];

export const RADIUS_OPTIONS = [0, 0.3, 0.5, 0.75, 1.0] as const;
export type RadiusOption = (typeof RADIUS_OPTIONS)[number];

// Font family per style preset
const STYLE_FONTS: Record<StylePreset, string> = {
  vega: "'Geist Sans', 'Geist', ui-sans-serif, system-ui, sans-serif",
  nova: "'Inter', ui-sans-serif, system-ui, sans-serif",
  maia: "'Nunito Sans', ui-sans-serif, system-ui, sans-serif",
  lyra: "'JetBrains Mono', ui-monospace, monospace",
  mira: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
};

// Default radius per style preset
const STYLE_DEFAULT_RADIUS: Record<StylePreset, number> = {
  vega: 0.5,
  nova: 0.5,
  maia: 1.0,
  lyra: 0,
  mira: 0.5,
};

// ---------------------------------------------------------------------------
// ThemeVars — every CSS custom property we manage
// ---------------------------------------------------------------------------

interface ThemeVars {
  background: string;
  foreground: string;
  card: string;
  "card-foreground": string;
  popover: string;
  "popover-foreground": string;
  primary: string;
  "primary-foreground": string;
  secondary: string;
  "secondary-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  "accent-foreground": string;
  destructive: string;
  border: string;
  input: string;
  ring: string;
  "chart-1": string;
  "chart-2": string;
  "chart-3": string;
  "chart-4": string;
  "chart-5": string;
  sidebar: string;
  "sidebar-foreground": string;
  "sidebar-primary": string;
  "sidebar-primary-foreground": string;
  "sidebar-accent": string;
  "sidebar-accent-foreground": string;
  "sidebar-border": string;
  "sidebar-ring": string;
}

// ---------------------------------------------------------------------------
// Neutral presets — complete variable sets for light & dark
// ---------------------------------------------------------------------------

const NEUTRAL_PRESETS: Record<NeutralColor, { light: ThemeVars; dark: ThemeVars }> = {
  neutral: {
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.145 0 0)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.145 0 0)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.145 0 0)",
      primary: "oklch(0.205 0 0)",
      "primary-foreground": "oklch(0.985 0 0)",
      secondary: "oklch(0.97 0 0)",
      "secondary-foreground": "oklch(0.205 0 0)",
      muted: "oklch(0.97 0 0)",
      "muted-foreground": "oklch(0.556 0 0)",
      accent: "oklch(0.97 0 0)",
      "accent-foreground": "oklch(0.205 0 0)",
      destructive: "oklch(0.577 0.245 27.325)",
      border: "oklch(0.922 0 0)",
      input: "oklch(0.922 0 0)",
      ring: "oklch(0.708 0 0)",
      "chart-1": "oklch(0.646 0.222 41.116)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
      sidebar: "oklch(0.985 0 0)",
      "sidebar-foreground": "oklch(0.145 0 0)",
      "sidebar-primary": "oklch(0.205 0 0)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-accent": "oklch(0.97 0 0)",
      "sidebar-accent-foreground": "oklch(0.205 0 0)",
      "sidebar-border": "oklch(0.922 0 0)",
      "sidebar-ring": "oklch(0.708 0 0)",
    },
    dark: {
      background: "oklch(0.145 0 0)",
      foreground: "oklch(0.985 0 0)",
      card: "oklch(0.205 0 0)",
      "card-foreground": "oklch(0.985 0 0)",
      popover: "oklch(0.205 0 0)",
      "popover-foreground": "oklch(0.985 0 0)",
      primary: "oklch(0.922 0 0)",
      "primary-foreground": "oklch(0.205 0 0)",
      secondary: "oklch(0.269 0 0)",
      "secondary-foreground": "oklch(0.985 0 0)",
      muted: "oklch(0.269 0 0)",
      "muted-foreground": "oklch(0.708 0 0)",
      accent: "oklch(0.269 0 0)",
      "accent-foreground": "oklch(0.985 0 0)",
      destructive: "oklch(0.704 0.191 22.216)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
      ring: "oklch(0.556 0 0)",
      "chart-1": "oklch(0.488 0.243 264.376)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
      sidebar: "oklch(0.205 0 0)",
      "sidebar-foreground": "oklch(0.985 0 0)",
      "sidebar-primary": "oklch(0.488 0.243 264.376)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-accent": "oklch(0.269 0 0)",
      "sidebar-accent-foreground": "oklch(0.985 0 0)",
      "sidebar-border": "oklch(1 0 0 / 10%)",
      "sidebar-ring": "oklch(0.556 0 0)",
    },
  },
  stone: {
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.147 0.004 49.25)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.147 0.004 49.25)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.147 0.004 49.25)",
      primary: "oklch(0.216 0.006 56.043)",
      "primary-foreground": "oklch(0.985 0.001 106.423)",
      secondary: "oklch(0.97 0.001 106.424)",
      "secondary-foreground": "oklch(0.216 0.006 56.043)",
      muted: "oklch(0.97 0.001 106.424)",
      "muted-foreground": "oklch(0.553 0.013 58.071)",
      accent: "oklch(0.97 0.001 106.424)",
      "accent-foreground": "oklch(0.216 0.006 56.043)",
      destructive: "oklch(0.577 0.245 27.325)",
      border: "oklch(0.923 0.003 48.717)",
      input: "oklch(0.923 0.003 48.717)",
      ring: "oklch(0.709 0.01 56.259)",
      "chart-1": "oklch(0.646 0.222 41.116)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
      sidebar: "oklch(0.985 0.001 106.423)",
      "sidebar-foreground": "oklch(0.147 0.004 49.25)",
      "sidebar-primary": "oklch(0.216 0.006 56.043)",
      "sidebar-primary-foreground": "oklch(0.985 0.001 106.423)",
      "sidebar-accent": "oklch(0.97 0.001 106.424)",
      "sidebar-accent-foreground": "oklch(0.216 0.006 56.043)",
      "sidebar-border": "oklch(0.923 0.003 48.717)",
      "sidebar-ring": "oklch(0.709 0.01 56.259)",
    },
    dark: {
      background: "oklch(0.147 0.004 49.25)",
      foreground: "oklch(0.985 0.001 106.423)",
      card: "oklch(0.216 0.006 56.043)",
      "card-foreground": "oklch(0.985 0.001 106.423)",
      popover: "oklch(0.216 0.006 56.043)",
      "popover-foreground": "oklch(0.985 0.001 106.423)",
      primary: "oklch(0.923 0.003 48.717)",
      "primary-foreground": "oklch(0.216 0.006 56.043)",
      secondary: "oklch(0.268 0.007 34.298)",
      "secondary-foreground": "oklch(0.985 0.001 106.423)",
      muted: "oklch(0.268 0.007 34.298)",
      "muted-foreground": "oklch(0.709 0.01 56.259)",
      accent: "oklch(0.268 0.007 34.298)",
      "accent-foreground": "oklch(0.985 0.001 106.423)",
      destructive: "oklch(0.704 0.191 22.216)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
      ring: "oklch(0.553 0.013 58.071)",
      "chart-1": "oklch(0.488 0.243 264.376)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
      sidebar: "oklch(0.216 0.006 56.043)",
      "sidebar-foreground": "oklch(0.985 0.001 106.423)",
      "sidebar-primary": "oklch(0.488 0.243 264.376)",
      "sidebar-primary-foreground": "oklch(0.985 0.001 106.423)",
      "sidebar-accent": "oklch(0.268 0.007 34.298)",
      "sidebar-accent-foreground": "oklch(0.985 0.001 106.423)",
      "sidebar-border": "oklch(1 0 0 / 10%)",
      "sidebar-ring": "oklch(0.553 0.013 58.071)",
    },
  },
  zinc: {
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.141 0.005 285.823)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.141 0.005 285.823)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.141 0.005 285.823)",
      primary: "oklch(0.21 0.006 285.885)",
      "primary-foreground": "oklch(0.985 0.002 247.839)",
      secondary: "oklch(0.967 0.001 286.375)",
      "secondary-foreground": "oklch(0.21 0.006 285.885)",
      muted: "oklch(0.967 0.001 286.375)",
      "muted-foreground": "oklch(0.552 0.016 285.938)",
      accent: "oklch(0.967 0.001 286.375)",
      "accent-foreground": "oklch(0.21 0.006 285.885)",
      destructive: "oklch(0.577 0.245 27.325)",
      border: "oklch(0.92 0.004 286.32)",
      input: "oklch(0.92 0.004 286.32)",
      ring: "oklch(0.705 0.015 286.067)",
      "chart-1": "oklch(0.646 0.222 41.116)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
      sidebar: "oklch(0.985 0.002 247.839)",
      "sidebar-foreground": "oklch(0.141 0.005 285.823)",
      "sidebar-primary": "oklch(0.21 0.006 285.885)",
      "sidebar-primary-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-accent": "oklch(0.967 0.001 286.375)",
      "sidebar-accent-foreground": "oklch(0.21 0.006 285.885)",
      "sidebar-border": "oklch(0.92 0.004 286.32)",
      "sidebar-ring": "oklch(0.705 0.015 286.067)",
    },
    dark: {
      background: "oklch(0.141 0.005 285.823)",
      foreground: "oklch(0.985 0.002 247.839)",
      card: "oklch(0.21 0.006 285.885)",
      "card-foreground": "oklch(0.985 0.002 247.839)",
      popover: "oklch(0.21 0.006 285.885)",
      "popover-foreground": "oklch(0.985 0.002 247.839)",
      primary: "oklch(0.92 0.004 286.32)",
      "primary-foreground": "oklch(0.21 0.006 285.885)",
      secondary: "oklch(0.274 0.006 286.033)",
      "secondary-foreground": "oklch(0.985 0.002 247.839)",
      muted: "oklch(0.274 0.006 286.033)",
      "muted-foreground": "oklch(0.705 0.015 286.067)",
      accent: "oklch(0.274 0.006 286.033)",
      "accent-foreground": "oklch(0.985 0.002 247.839)",
      destructive: "oklch(0.704 0.191 22.216)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
      ring: "oklch(0.552 0.016 285.938)",
      "chart-1": "oklch(0.488 0.243 264.376)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
      sidebar: "oklch(0.21 0.006 285.885)",
      "sidebar-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-primary": "oklch(0.488 0.243 264.376)",
      "sidebar-primary-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-accent": "oklch(0.274 0.006 286.033)",
      "sidebar-accent-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-border": "oklch(1 0 0 / 10%)",
      "sidebar-ring": "oklch(0.552 0.016 285.938)",
    },
  },
  gray: {
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.13 0.028 261.692)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.13 0.028 261.692)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.13 0.028 261.692)",
      primary: "oklch(0.21 0.034 264.665)",
      "primary-foreground": "oklch(0.985 0.002 247.839)",
      secondary: "oklch(0.968 0.007 264.536)",
      "secondary-foreground": "oklch(0.21 0.034 264.665)",
      muted: "oklch(0.968 0.007 264.536)",
      "muted-foreground": "oklch(0.551 0.027 264.364)",
      accent: "oklch(0.968 0.007 264.536)",
      "accent-foreground": "oklch(0.21 0.034 264.665)",
      destructive: "oklch(0.577 0.245 27.325)",
      border: "oklch(0.928 0.006 264.531)",
      input: "oklch(0.928 0.006 264.531)",
      ring: "oklch(0.707 0.022 261.325)",
      "chart-1": "oklch(0.646 0.222 41.116)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
      sidebar: "oklch(0.985 0.002 247.839)",
      "sidebar-foreground": "oklch(0.13 0.028 261.692)",
      "sidebar-primary": "oklch(0.21 0.034 264.665)",
      "sidebar-primary-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-accent": "oklch(0.968 0.007 264.536)",
      "sidebar-accent-foreground": "oklch(0.21 0.034 264.665)",
      "sidebar-border": "oklch(0.928 0.006 264.531)",
      "sidebar-ring": "oklch(0.707 0.022 261.325)",
    },
    dark: {
      background: "oklch(0.13 0.028 261.692)",
      foreground: "oklch(0.985 0.002 247.839)",
      card: "oklch(0.21 0.034 264.665)",
      "card-foreground": "oklch(0.985 0.002 247.839)",
      popover: "oklch(0.21 0.034 264.665)",
      "popover-foreground": "oklch(0.985 0.002 247.839)",
      primary: "oklch(0.928 0.006 264.531)",
      "primary-foreground": "oklch(0.21 0.034 264.665)",
      secondary: "oklch(0.279 0.029 260.031)",
      "secondary-foreground": "oklch(0.985 0.002 247.839)",
      muted: "oklch(0.279 0.029 260.031)",
      "muted-foreground": "oklch(0.707 0.022 261.325)",
      accent: "oklch(0.279 0.029 260.031)",
      "accent-foreground": "oklch(0.985 0.002 247.839)",
      destructive: "oklch(0.704 0.191 22.216)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
      ring: "oklch(0.551 0.027 264.364)",
      "chart-1": "oklch(0.488 0.243 264.376)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
      sidebar: "oklch(0.21 0.034 264.665)",
      "sidebar-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-primary": "oklch(0.488 0.243 264.376)",
      "sidebar-primary-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-accent": "oklch(0.279 0.029 260.031)",
      "sidebar-accent-foreground": "oklch(0.985 0.002 247.839)",
      "sidebar-border": "oklch(1 0 0 / 10%)",
      "sidebar-ring": "oklch(0.551 0.027 264.364)",
    },
  },
  slate: {
    light: {
      background: "oklch(1 0 0)",
      foreground: "oklch(0.129 0.042 264.695)",
      card: "oklch(1 0 0)",
      "card-foreground": "oklch(0.129 0.042 264.695)",
      popover: "oklch(1 0 0)",
      "popover-foreground": "oklch(0.129 0.042 264.695)",
      primary: "oklch(0.208 0.042 265.755)",
      "primary-foreground": "oklch(0.984 0.003 247.858)",
      secondary: "oklch(0.968 0.007 264.536)",
      "secondary-foreground": "oklch(0.208 0.042 265.755)",
      muted: "oklch(0.968 0.007 264.536)",
      "muted-foreground": "oklch(0.554 0.046 257.417)",
      accent: "oklch(0.968 0.007 264.536)",
      "accent-foreground": "oklch(0.208 0.042 265.755)",
      destructive: "oklch(0.577 0.245 27.325)",
      border: "oklch(0.929 0.013 255.508)",
      input: "oklch(0.929 0.013 255.508)",
      ring: "oklch(0.704 0.04 256.788)",
      "chart-1": "oklch(0.646 0.222 41.116)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
      sidebar: "oklch(0.984 0.003 247.858)",
      "sidebar-foreground": "oklch(0.129 0.042 264.695)",
      "sidebar-primary": "oklch(0.208 0.042 265.755)",
      "sidebar-primary-foreground": "oklch(0.984 0.003 247.858)",
      "sidebar-accent": "oklch(0.968 0.007 264.536)",
      "sidebar-accent-foreground": "oklch(0.208 0.042 265.755)",
      "sidebar-border": "oklch(0.929 0.013 255.508)",
      "sidebar-ring": "oklch(0.704 0.04 256.788)",
    },
    dark: {
      background: "oklch(0.129 0.042 264.695)",
      foreground: "oklch(0.984 0.003 247.858)",
      card: "oklch(0.208 0.042 265.755)",
      "card-foreground": "oklch(0.984 0.003 247.858)",
      popover: "oklch(0.208 0.042 265.755)",
      "popover-foreground": "oklch(0.984 0.003 247.858)",
      primary: "oklch(0.929 0.013 255.508)",
      "primary-foreground": "oklch(0.208 0.042 265.755)",
      secondary: "oklch(0.279 0.041 260.873)",
      "secondary-foreground": "oklch(0.984 0.003 247.858)",
      muted: "oklch(0.279 0.041 260.873)",
      "muted-foreground": "oklch(0.704 0.04 256.788)",
      accent: "oklch(0.279 0.041 260.873)",
      "accent-foreground": "oklch(0.984 0.003 247.858)",
      destructive: "oklch(0.704 0.191 22.216)",
      border: "oklch(1 0 0 / 10%)",
      input: "oklch(1 0 0 / 15%)",
      ring: "oklch(0.554 0.046 257.417)",
      "chart-1": "oklch(0.488 0.243 264.376)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
      sidebar: "oklch(0.208 0.042 265.755)",
      "sidebar-foreground": "oklch(0.984 0.003 247.858)",
      "sidebar-primary": "oklch(0.488 0.243 264.376)",
      "sidebar-primary-foreground": "oklch(0.984 0.003 247.858)",
      "sidebar-accent": "oklch(0.279 0.041 260.873)",
      "sidebar-accent-foreground": "oklch(0.984 0.003 247.858)",
      "sidebar-border": "oklch(1 0 0 / 10%)",
      "sidebar-ring": "oklch(0.554 0.046 257.417)",
    },
  },
};

// ---------------------------------------------------------------------------
// Base color overrides — only the accent/primary/chart vars that change
// ---------------------------------------------------------------------------

const BASE_COLOR_OVERRIDES: Record<
  BaseColor,
  { light: Partial<ThemeVars>; dark: Partial<ThemeVars> }
> = {
  blue: {
    light: {
      primary: "oklch(0.546 0.245 262.881)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.546 0.245 262.881)",
      "sidebar-primary": "oklch(0.546 0.245 262.881)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.546 0.245 262.881)",
      "chart-1": "oklch(0.546 0.245 262.881)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
    },
    dark: {
      primary: "oklch(0.623 0.214 259.815)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.623 0.214 259.815)",
      "sidebar-primary": "oklch(0.623 0.214 259.815)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.623 0.214 259.815)",
      "chart-1": "oklch(0.623 0.214 259.815)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
    },
  },
  green: {
    light: {
      primary: "oklch(0.596 0.145 163.225)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.596 0.145 163.225)",
      "sidebar-primary": "oklch(0.596 0.145 163.225)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.596 0.145 163.225)",
      "chart-1": "oklch(0.596 0.145 163.225)",
      "chart-2": "oklch(0.546 0.245 262.881)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
    },
    dark: {
      primary: "oklch(0.648 0.15 160.0)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.648 0.15 160.0)",
      "sidebar-primary": "oklch(0.648 0.15 160.0)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.648 0.15 160.0)",
      "chart-1": "oklch(0.648 0.15 160.0)",
      "chart-2": "oklch(0.623 0.214 259.815)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
    },
  },
  orange: {
    light: {
      primary: "oklch(0.705 0.213 47.604)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.705 0.213 47.604)",
      "sidebar-primary": "oklch(0.705 0.213 47.604)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.705 0.213 47.604)",
      "chart-1": "oklch(0.705 0.213 47.604)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.546 0.245 262.881)",
      "chart-5": "oklch(0.769 0.188 70.08)",
    },
    dark: {
      primary: "oklch(0.705 0.213 47.604)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.705 0.213 47.604)",
      "sidebar-primary": "oklch(0.705 0.213 47.604)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.705 0.213 47.604)",
      "chart-1": "oklch(0.705 0.213 47.604)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.623 0.214 259.815)",
    },
  },
  red: {
    light: {
      primary: "oklch(0.577 0.245 27.325)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.577 0.245 27.325)",
      "sidebar-primary": "oklch(0.577 0.245 27.325)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.577 0.245 27.325)",
      "chart-1": "oklch(0.577 0.245 27.325)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
    },
    dark: {
      primary: "oklch(0.645 0.246 16.439)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.645 0.246 16.439)",
      "sidebar-primary": "oklch(0.645 0.246 16.439)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.645 0.246 16.439)",
      "chart-1": "oklch(0.645 0.246 16.439)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.623 0.214 259.815)",
    },
  },
  rose: {
    light: {
      primary: "oklch(0.645 0.246 16.439)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.645 0.246 16.439)",
      "sidebar-primary": "oklch(0.645 0.246 16.439)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.645 0.246 16.439)",
      "chart-1": "oklch(0.645 0.246 16.439)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
    },
    dark: {
      primary: "oklch(0.645 0.246 16.439)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.645 0.246 16.439)",
      "sidebar-primary": "oklch(0.645 0.246 16.439)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.645 0.246 16.439)",
      "chart-1": "oklch(0.645 0.246 16.439)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.623 0.214 259.815)",
    },
  },
  violet: {
    light: {
      primary: "oklch(0.606 0.25 292.717)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.606 0.25 292.717)",
      "sidebar-primary": "oklch(0.606 0.25 292.717)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.606 0.25 292.717)",
      "chart-1": "oklch(0.606 0.25 292.717)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.828 0.189 84.429)",
      "chart-5": "oklch(0.769 0.188 70.08)",
    },
    dark: {
      primary: "oklch(0.627 0.265 303.9)",
      "primary-foreground": "oklch(0.985 0 0)",
      ring: "oklch(0.627 0.265 303.9)",
      "sidebar-primary": "oklch(0.627 0.265 303.9)",
      "sidebar-primary-foreground": "oklch(0.985 0 0)",
      "sidebar-ring": "oklch(0.627 0.265 303.9)",
      "chart-1": "oklch(0.627 0.265 303.9)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.623 0.214 259.815)",
      "chart-5": "oklch(0.645 0.246 16.439)",
    },
  },
  yellow: {
    light: {
      primary: "oklch(0.795 0.184 86.047)",
      "primary-foreground": "oklch(0.21 0.034 264.665)",
      ring: "oklch(0.795 0.184 86.047)",
      "sidebar-primary": "oklch(0.795 0.184 86.047)",
      "sidebar-primary-foreground": "oklch(0.21 0.034 264.665)",
      "sidebar-ring": "oklch(0.795 0.184 86.047)",
      "chart-1": "oklch(0.795 0.184 86.047)",
      "chart-2": "oklch(0.6 0.118 184.704)",
      "chart-3": "oklch(0.398 0.07 227.392)",
      "chart-4": "oklch(0.546 0.245 262.881)",
      "chart-5": "oklch(0.769 0.188 70.08)",
    },
    dark: {
      primary: "oklch(0.795 0.184 86.047)",
      "primary-foreground": "oklch(0.21 0.034 264.665)",
      ring: "oklch(0.795 0.184 86.047)",
      "sidebar-primary": "oklch(0.795 0.184 86.047)",
      "sidebar-primary-foreground": "oklch(0.21 0.034 264.665)",
      "sidebar-ring": "oklch(0.795 0.184 86.047)",
      "chart-1": "oklch(0.795 0.184 86.047)",
      "chart-2": "oklch(0.696 0.17 162.48)",
      "chart-3": "oklch(0.769 0.188 70.08)",
      "chart-4": "oklch(0.627 0.265 303.9)",
      "chart-5": "oklch(0.645 0.246 16.439)",
    },
  },
};

// ---------------------------------------------------------------------------
// Swatch colors — representative colors for the UI swatches
// ---------------------------------------------------------------------------

export const NEUTRAL_SWATCH_COLORS: Record<NeutralColor, string> = {
  neutral: "oklch(0.556 0 0)",
  stone: "oklch(0.553 0.013 58.071)",
  zinc: "oklch(0.552 0.016 285.938)",
  gray: "oklch(0.551 0.027 264.364)",
  slate: "oklch(0.554 0.046 257.417)",
};

export const BASE_SWATCH_COLORS: Record<BaseColor, string> = {
  blue: "oklch(0.546 0.245 262.881)",
  green: "oklch(0.596 0.145 163.225)",
  orange: "oklch(0.705 0.213 47.604)",
  red: "oklch(0.577 0.245 27.325)",
  rose: "oklch(0.645 0.246 16.439)",
  violet: "oklch(0.606 0.25 292.717)",
  yellow: "oklch(0.795 0.184 86.047)",
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface ThemeConfig {
  style: StylePreset;
  neutralColor: NeutralColor;
  baseColor: BaseColor;
  radius: number;
  mode: ThemeMode;
}

interface ThemeContextValue {
  config: ThemeConfig;
  setStyle: (style: StylePreset) => void;
  setNeutralColor: (color: NeutralColor) => void;
  setBaseColor: (color: BaseColor) => void;
  setRadius: (radius: number) => void;
  setMode: (mode: ThemeMode) => void;
  resetTheme: () => void;
  /** The resolved mode (never "system") — always "light" or "dark" */
  resolvedMode: "light" | "dark";
}

const STORAGE_KEY = "email-annotation-theme";

const DEFAULT_CONFIG: ThemeConfig = {
  style: "vega",
  neutralColor: "zinc",
  baseColor: "blue",
  radius: 0.5,
  mode: "light",
};

function loadConfig(): ThemeConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ThemeConfig>;
      return {
        style: parsed.style ?? DEFAULT_CONFIG.style,
        neutralColor: parsed.neutralColor ?? DEFAULT_CONFIG.neutralColor,
        baseColor: parsed.baseColor ?? DEFAULT_CONFIG.baseColor,
        radius: parsed.radius ?? DEFAULT_CONFIG.radius,
        mode: parsed.mode ?? DEFAULT_CONFIG.mode,
      };
    }
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: ThemeConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

function getSystemPreference(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return getSystemPreference();
  return mode;
}

function applyTheme(config: ThemeConfig, resolved: "light" | "dark") {
  const root = document.documentElement;

  // Dark mode class
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Style preset attribute
  root.setAttribute("data-style", config.style);

  // Color variables
  const neutralVars = NEUTRAL_PRESETS[config.neutralColor][resolved];
  const baseOverrides = BASE_COLOR_OVERRIDES[config.baseColor][resolved];
  const merged: ThemeVars = { ...neutralVars, ...baseOverrides };

  for (const [key, value] of Object.entries(merged)) {
    root.style.setProperty(`--${key}`, value);
  }

  root.style.setProperty("--radius", `${config.radius}rem`);
  root.style.setProperty("--font-sans", STYLE_FONTS[config.style]);
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ThemeConfig>(loadConfig);
  const [resolvedMode, setResolvedMode] = useState<"light" | "dark">(() =>
    resolveMode(config.mode)
  );

  // Apply theme on config or resolved mode change
  useLayoutEffect(() => {
    const resolved = resolveMode(config.mode);
    setResolvedMode(resolved);
    applyTheme(config, resolved);
    saveConfig(config);
  }, [config]);

  // Listen to system preference changes when mode is "system"
  useEffect(() => {
    if (config.mode !== "system") return;

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const resolved = resolveMode("system");
      setResolvedMode(resolved);
      applyTheme(config, resolved);
    };
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [config]);

  const setStyle = useCallback((style: StylePreset) => {
    setConfig((prev) => ({
      ...prev,
      style,
      radius: STYLE_DEFAULT_RADIUS[style],
    }));
  }, []);

  const setNeutralColor = useCallback((neutralColor: NeutralColor) => {
    setConfig((prev) => ({ ...prev, neutralColor }));
  }, []);

  const setBaseColor = useCallback((baseColor: BaseColor) => {
    setConfig((prev) => ({ ...prev, baseColor }));
  }, []);

  const setRadius = useCallback((radius: number) => {
    setConfig((prev) => ({ ...prev, radius }));
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setConfig((prev) => ({ ...prev, mode }));
  }, []);

  const resetTheme = useCallback(() => {
    setConfig(DEFAULT_CONFIG);
  }, []);

  return (
    <ThemeContext.Provider
      value={{
        config,
        setStyle,
        setNeutralColor,
        setBaseColor,
        setRadius,
        setMode,
        resetTheme,
        resolvedMode,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
