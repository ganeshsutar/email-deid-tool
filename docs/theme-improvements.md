# Theme Settings & Profile Menu — Improvement Plan

## Current State Analysis

### What Exists Today

**Theme System (`src/lib/theme.tsx`)**
- Custom OKLCH color space implementation (no `next-themes`)
- 5 style presets (Vega, Nova, Maia, Lyra, Mira) — font family + density overrides
- 5 neutral colors (Neutral, Stone, Zinc, Gray, Slate)
- 7 base/accent colors (Blue, Green, Orange, Red, Rose, Violet, Yellow)
- 5 border-radius options (0, 0.3, 0.5, 0.75, 1.0)
- 3 mode options (Light, Dark, System)
- Persisted to `localStorage`, applied as CSS custom properties on `<html>`

**Profile Menu (two variants)**
- `user-dropdown.tsx` — top-nav dropdown for Annotator/QA roles
- `sidebar-user.tsx` — sidebar footer dropdown for Admin role
- Both contain: theme submenus (5 levels deep), avatar change, change password, logout
- Admin variant also includes a Settings link

**Unused Component**
- `theme-customizer.tsx` — compact popover with all theme controls in one panel, currently not wired into any layout

---

## Problems Identified

### 1. Theme Controls Buried in Deep Submenus
Theme customization requires navigating through **nested submenus** inside the profile dropdown. Each axis (style, mode, neutral, base color, radius) is a separate submenu — users must open/close 5 submenus to fully customize. This is tedious and hides a powerful feature.

### 2. Profile Menu Mixes Identity with Appearance
The dropdown conflates two unrelated concerns:
- **Identity**: avatar, password, logout
- **Appearance**: style, mode, colors, radius

This creates a cluttered menu with 6+ submenu groups and 2 dialogs. Users looking for theme settings wouldn't intuitively check their profile menu.

### 3. No Live Preview
When selecting a neutral or base color from a submenu, the change applies immediately but the submenu closes. Users can't see the effect in context before committing, and comparing options requires repeatedly opening the same submenu.

### 4. `theme-customizer.tsx` Exists but Is Unused
A compact popover component already exists with all theme controls in a single panel — but it's not integrated into any layout. This is the better UX pattern since all options are visible at once.

### 5. No Curated Theme Presets
Users must manually combine style + neutral + accent + radius + mode to get a cohesive look. There are no "one-click" curated combinations (e.g., "Warm Minimal", "Cool Professional", "Midnight Hacker").

### 6. No Font Size / Scaling Control
Style presets control font family and density, but there's no way to adjust overall font size or UI scale — important for accessibility and user comfort on different displays.

### 7. No Contrast or Accessibility Feedback
OKLCH is great for perceptual uniformity, but some neutral + accent combinations may produce poor contrast ratios. No visual indicator warns users when their chosen combination might have accessibility issues.

### 8. Style Preset Descriptions Are Opaque
Preset names (Vega, Nova, Maia, Lyra, Mira) are creative but give no hint about what they look like. Users must try each one to understand the difference.

---

## Proposed Improvements

### Improvement 1: Dedicated Theme Panel (Replace Submenus)

**Priority: High | Effort: Medium**

Replace the 5 nested theme submenus in the profile dropdown with a single **"Appearance"** item that opens a dedicated sheet/panel.

**Implementation:**
- Add an "Appearance" menu item (with `Paintbrush` icon) to the profile dropdown
- Clicking it opens a `Sheet` (slide-in panel from the right) with all theme controls
- Remove all theme-related submenus from the profile dropdown
- Reuse and enhance the existing `theme-customizer.tsx` component as the panel content

**Panel Layout (top to bottom):**
```
┌─────────────────────────────────────┐
│  Appearance                    [X]  │
├─────────────────────────────────────┤
│                                     │
│  Mode           [Light|Dark|System] │
│                                     │
│  Style                              │
│  ┌──────┐ ┌──────┐ ┌──────┐        │
│  │ Vega │ │ Nova │ │ Maia │  ...   │
│  │ Sans │ │Tight │ │ Bold │        │
│  └──────┘ └──────┘ └──────┘        │
│                                     │
│  Neutral Color                      │
│  (●) (●) (●) (●) (●)              │
│                                     │
│  Accent Color                       │
│  (●) (●) (●) (●) (●) (●) (●)     │
│                                     │
│  Border Radius                      │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐        │
│  │  │ │  │ │  │ │  │ │  │  0→1.0  │
│  └──┘ └──┘ └──┘ └──┘ └──┘        │
│                                     │
│  ───────────────────────────────    │
│  [Reset to Defaults]                │
│                                     │
└─────────────────────────────────────┘
```

**Benefits:**
- All options visible at once — no submenu diving
- Changes apply live, user sees results immediately in the background
- Sheet stays open while user experiments
- Clean separation from profile/identity actions

---

### Improvement 2: Curated Theme Presets (One-Click Themes)

**Priority: High | Effort: Medium**

Add a "Presets" section at the top of the Appearance panel with curated combinations.

**Suggested Presets:**

| Preset Name | Style | Neutral | Accent | Radius | Mode |
|---|---|---|---|---|---|
| **Default** | Vega | Zinc | Blue | 0.5 | Light |
| **Warm Minimal** | Mira | Stone | Orange | 0.75 | Light |
| **Cool Professional** | Nova | Slate | Blue | 0.3 | Light |
| **Midnight** | Lyra | Neutral | Violet | 0 | Dark |
| **Forest** | Maia | Stone | Green | 1.0 | Light |
| **Rose Quartz** | Mira | Neutral | Rose | 0.75 | Light |
| **Dark Hacker** | Lyra | Zinc | Green | 0 | Dark |
| **Sunset** | Vega | Stone | Red | 0.5 | Dark |

**Implementation:**
```typescript
export const ThemePreset = {
  DEFAULT: "default",
  WARM_MINIMAL: "warm-minimal",
  COOL_PROFESSIONAL: "cool-professional",
  MIDNIGHT: "midnight",
  FOREST: "forest",
  ROSE_QUARTZ: "rose-quartz",
  DARK_HACKER: "dark-hacker",
  SUNSET: "sunset",
} as const;

const THEME_PRESETS: Record<ThemePreset, ThemeConfig> = {
  // ... preset definitions
};
```

**UI:** Horizontal scrollable row of small preview cards, each showing a mini swatch of the color combination + name. Clicking applies the full `ThemeConfig` at once.

---

### Improvement 3: Style Preset Descriptions & Previews

**Priority: Medium | Effort: Low**

Add descriptive subtitles and visual cues to style presets so users understand them without trial-and-error.

**Current:** Just the name (e.g., "Vega")
**Proposed:** Name + font preview + description

```
┌─────────────────────┐
│  Vega               │
│  Aa  Balanced, clean│
│  Geist Sans         │
└─────────────────────┘

┌─────────────────────┐
│  Nova               │
│  Aa  Compact, tight │
│  Inter              │
└─────────────────────┘

┌─────────────────────┐
│  Maia               │
│  Aa  Bold, rounded  │
│  Nunito Sans        │
└─────────────────────┘

┌─────────────────────┐
│  Lyra               │
│  Aa  Sharp, mono    │
│  JetBrains Mono     │
└─────────────────────┘

┌─────────────────────┐
│  Mira               │
│  Aa  Refined, medium│
│  DM Sans            │
└─────────────────────┘
```

Each card renders its "Aa" in the actual font so users get a visual preview.

---

### Improvement 4: Streamlined Profile Menu

**Priority: High | Effort: Low**

After extracting theme controls to the Appearance sheet, the profile dropdown becomes clean and focused:

```
┌──────────────────────────┐
│  👤 John Doe             │
│  john@example.com        │
├──────────────────────────┤
│  🎨 Appearance...        │  → Opens Appearance sheet
├──────────────────────────┤
│  🖼  Change Avatar       │
│  🔑 Change Password      │
├──────────────────────────┤
│  ⚙️  Settings            │  (Admin only)
├──────────────────────────┤
│  🚪 Log Out              │
└──────────────────────────┘
```

**Benefits:**
- 5 items max (down from 10+ with submenus)
- Clear grouping: appearance → account → session
- Scannable at a glance

---

### Improvement 5: Font Size / UI Scale Control

**Priority: Medium | Effort: Medium**

Add a font size slider or step control to the Appearance panel.

**Implementation:**
- Add `fontSize` to `ThemeConfig`: `"small" | "default" | "large" | "x-large"`
- Apply via CSS custom property: `--font-scale: 0.875 | 1 | 1.125 | 1.25`
- Set `font-size: calc(var(--font-scale) * 1rem)` on `<html>`
- All `rem`-based sizing scales proportionally

```typescript
export const FontSize = {
  SMALL: "small",     // 14px base
  DEFAULT: "default", // 16px base
  LARGE: "large",     // 18px base
  X_LARGE: "x-large", // 20px base
} as const;
```

**UI:** A toggle group with `A` (small), `A` (medium), **A** (large), **A** (x-large) — each rendered at its actual size.

---

### Improvement 6: Sidebar Accent Color (Admin Layout Enhancement)

**Priority: Low | Effort: Medium**

The admin sidebar currently uses neutral-derived sidebar colors. Allow the accent color to tint the sidebar for a more branded feel.

**Implementation:**
- Add `sidebarTint` toggle to `ThemeConfig`: `boolean` (default `false`)
- When enabled, apply base color as a subtle tint to sidebar background
- Use OKLCH to derive a very low-chroma version of the accent for the sidebar background

**Example (accent = Blue, tint enabled):**
- Sidebar bg: `oklch(0.97 0.01 262)` (barely blue, mostly neutral)
- Active item: `oklch(0.93 0.03 262)` (slightly more saturated)

---

### Improvement 7: Color Contrast Indicator

**Priority: Low | Effort: Medium**

Show a small accessibility indicator when the user's chosen neutral + accent combination might produce poor contrast.

**Implementation:**
- Calculate WCAG contrast ratio between `--primary` and `--primary-foreground`
- Display a small badge in the Appearance panel:
  - Green checkmark: AAA (>= 7:1)
  - Yellow warning: AA (>= 4.5:1)
  - Red warning: Below AA (< 4.5:1)
- OKLCH makes this calculation straightforward via the `L` (lightness) channel

---

### Improvement 8: Quick Theme Toggle in Header

**Priority: Low | Effort: Low**

Add a small light/dark mode toggle button in the header bar (next to the profile dropdown) for the most common theme action — switching between light and dark mode.

**Implementation:**
- Sun/Moon icon button, `h-8 w-8`
- Cycles: Light → Dark → System → Light
- Tooltip shows current mode
- Already common UX pattern, reduces clicks for the #1 theme action

---

## Implementation Roadmap

### Phase 1 — Quick Wins (1-2 days)
1. **Improvement 4**: Streamline profile menu (remove theme submenus, add "Appearance" item)
2. **Improvement 1**: Wire up `theme-customizer.tsx` as a Sheet triggered from "Appearance"
3. **Improvement 3**: Add descriptions to style presets in the panel

### Phase 2 — Enhanced Experience (2-3 days)
4. **Improvement 2**: Curated theme presets with one-click application
5. **Improvement 5**: Font size / UI scale control
6. **Improvement 8**: Quick dark/light toggle in header

### Phase 3 — Polish (1-2 days)
7. **Improvement 6**: Sidebar accent tinting option
8. **Improvement 7**: Contrast accessibility indicator

---

## Files to Modify

| File | Changes |
|---|---|
| `src/lib/theme.tsx` | Add `fontSize` to config, add preset definitions, add sidebar tint logic |
| `src/components/theme-customizer.tsx` | Expand into full Appearance sheet, add preset cards, font size control |
| `src/components/layouts/user-dropdown.tsx` | Remove theme submenus, add "Appearance" sheet trigger |
| `src/components/layouts/sidebar-user.tsx` | Same as above for admin variant |
| `src/index.css` | Add `--font-scale` variable, scale base `font-size` |
| `src/styles/style-presets.css` | Add font size overrides per scale level |

**New files:**
| File | Purpose |
|---|---|
| `src/components/appearance-sheet.tsx` | Dedicated appearance panel (Sheet component) |
| `src/lib/theme-presets.ts` | Curated preset definitions (keep `theme.tsx` focused) |
