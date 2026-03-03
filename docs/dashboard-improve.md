# Dashboard Improvement Suggestions

Analysis of the current admin, annotator, and QA dashboards with actionable improvement recommendations.

---

## 1. Admin Dashboard

### 1.1 Stats Cards — Responsiveness

**Problem:** The first row uses a fixed `grid-cols-4` and the second row `grid-cols-6`, which break on smaller screens. No `sm:` or `md:` breakpoints are set.

**Suggestion:** Add responsive breakpoints:
```
Row 1: grid-cols-2 sm:grid-cols-4
Row 2: The inner grid-cols-3 groups should stack on small screens
```

### 1.2 Stats Cards — Visual Hierarchy

**Problem:** All 8 cards look identical — same gradient, same sizing. "Delivered" and "Discarded" (the two outcome metrics that matter most) blend in with totals.

**Suggestion:**
- Give "Delivered" a subtle green tint (`from-green-500/5`) and "Discarded" a subtle red tint (`from-red-500/5`) to visually distinguish outcomes from counts.
- Consider making the "Total Jobs" card a larger "hero" card spanning 2 columns, since it's the primary aggregate.
- Add a trend indicator (up/down arrow + percentage change) if historical data is available — even a "vs. last week" would add significant value.

### 1.3 Stats Cards — Percentage Display

**Problem:** Delivered shows values like `12 (42.86%)` with two decimal places — overly precise and harder to scan.

**Suggestion:** Round to whole percentage or one decimal at most: `12 (43%)`.

### 1.4 Job Status Chart — Empty State

**Problem:** If all counts are 0, the chart renders an empty axis with no message.

**Suggestion:** Show an `EmptyState` component ("No jobs yet — upload a dataset to get started") instead of an empty chart frame.

### 1.5 Job Status Chart — Color Per Status

**Problem:** In simple (non-stacked) mode, all bars use the same color (`var(--chart-1)`). This makes it harder to scan for specific statuses at a glance.

**Suggestion:** Assign a distinct color to each status (e.g., green for Delivered, red for Rejected, amber for In Progress). This creates instant visual meaning without needing to read labels.

### 1.6 Job Status Chart — Donut/Pie Alternative

**Problem:** A bar chart is good for comparing absolute counts, but for understanding proportional distribution, a donut chart is more intuitive.

**Suggestion:** Add a toggle between bar chart and donut/pie chart view. The donut works well for the simple view showing "where are jobs in the pipeline right now?"

### 1.7 Recent Datasets Table — Date Format

**Problem:** Uses `toLocaleDateString()` which varies by browser locale and can show inconsistent formats.

**Suggestion:** Use a consistent format via `date-fns` (already imported elsewhere): `format(new Date(ds.uploadDate), "MMM d, yyyy")` for "Feb 24, 2026" style.

### 1.8 Recent Datasets Table — Missing "Uploaded By" Column

**Problem:** The `RecentDataset` type includes `uploadedBy` data but it's not displayed in the table.

**Suggestion:** Add an "Uploaded By" column — useful when multiple admins manage the platform.

### 1.9 Performance Tables — Too Many Columns

**Problem:** The annotator performance table has 9 columns. On smaller screens or when side-by-side with QA table, columns become cramped and hard to read.

**Suggestions:**
- Implement column visibility toggles (a popover with checkboxes to show/hide columns).
- Default to showing the 5 most important columns (Name, Assigned, Completed, Acceptance %, Avg Ann/Job).
- Move secondary columns (Pending, In Progress, QA Rejected, Discarded) behind the toggle.

### 1.10 Performance Tables — Sparkline/Mini Charts

**Problem:** All performance data is raw numbers — takes mental effort to compare annotators.

**Suggestion:** Add a small inline bar or sparkline next to "Acceptance %" to make comparison visual. A simple colored bar (`bg-green-500` proportional to the percentage) in the cell would be effective.

### 1.11 Performance Tables — Row Hover Detail

**Problem:** The annotator table has a click-to-open detail dialog, but there's no visual cue that rows are clickable.

**Suggestion:** Add `hover:bg-muted/50` to table rows and a subtle right-chevron icon in the last column to signal interactivity. The QA table rows don't have click-to-detail — consider adding parity.

### 1.12 Quick Actions — Position & Design

**Problem:** Quick actions are small outline buttons crammed into the top-right header. They're easy to miss and two of them ("Assign Annotation Jobs" and "Assign QA Jobs") link to the same page.

**Suggestions:**
- Merge the two "Assign" buttons into a single "Assign Jobs" button since they go to the same route.
- Consider making quick actions more prominent — either as a horizontal card strip below the header or as icon-only buttons with tooltips to save space.

### 1.13 Overall — Auto-Refresh

**Problem:** Dashboard data is fetched once and only refreshes on page revisit (refetchOnWindowFocus is disabled globally).

**Suggestion:** Add a visible "Last updated: X minutes ago" timestamp with a manual refresh button. Optionally, add auto-refresh on an interval (every 2-5 minutes) since the dashboard is a monitoring view.

### 1.14 Overall — Pipeline Funnel Visualization

**Problem:** The job lifecycle (UPLOADED -> ... -> DELIVERED) is a pipeline, but the current bar chart doesn't communicate the flow/progression.

**Suggestion:** Add a horizontal funnel or Sankey-style visualization showing job flow through the pipeline. Even a simple horizontal stepper with counts at each stage would show where bottlenecks are at a glance.

---

## 2. Annotator Dashboard

### 2.1 No Analytics/Summary Cards

**Problem:** The annotator dashboard is purely a job queue — just a table with filters. Annotators have no visibility into their own performance metrics.

**Suggestions:**
- Add summary cards above the table: "Total Assigned", "Completed", "In Progress", "Acceptance Rate".
- Show a small completion progress bar or ring showing overall progress (completed / assigned).
- These are motivational and help annotators self-manage.

### 2.2 Search Requires Button Click

**Problem:** The search form requires clicking a "Search" button. Modern UX expectation is debounced search-as-you-type.

**Suggestion:** Implement debounced search (300ms delay) that triggers automatically as the user types. Keep the explicit button as a fallback but make it optional.

### 2.3 No Priority/Urgency Indicators

**Problem:** All jobs in the list look the same — there's no indication of which jobs are older or might need attention first.

**Suggestion:** Add a "Days Since Assigned" or "Age" column, and highlight jobs that have been pending for longer than a configurable threshold (e.g., 3+ days) with a subtle warning color.

### 2.4 Missing Bulk Actions

**Problem:** Annotators can only interact with one job at a time from the dashboard.

**Suggestion:** If applicable to your workflow, consider allowing batch "Start Annotation" for multiple assigned jobs, or at minimum, allow selecting and opening multiple jobs in tabs.

---

## 3. QA Dashboard

### 3.1 Same Issues as Annotator Dashboard

The QA dashboard mirrors the annotator dashboard structurally and has the same limitations: no personal analytics cards, button-click search, no urgency indicators.

### 3.2 No "Blind Review" Indicator

**Problem:** The platform has a blind review toggle (in settings), but the QA dashboard doesn't indicate whether blind review is currently active.

**Suggestion:** Show a small badge or notice when blind review is enabled — e.g., "Blind Review Active" chip near the page title. This reminds QA reviewers of the current mode.

---

## 4. Cross-Cutting Improvements

### 4.1 Keyboard Navigation

**Problem:** No keyboard shortcuts for common dashboard actions.

**Suggestion:** Add keyboard shortcuts for power users: `R` to refresh, `1-4` to switch status tabs, `/` to focus search.

### 4.2 Data Export from Dashboard

**Problem:** The Job Status Chart has CSV download, but the performance tables don't.

**Suggestion:** Add CSV/Excel export buttons to both performance tables (annotator and QA). Admins often need to export these for reporting.

### 4.3 Dark Mode Chart Contrast

**Problem:** The chart uses `var(--chart-N)` CSS variables, but there's no guarantee these have sufficient contrast in dark mode, especially the grid lines and axis text.

**Suggestion:** Verify chart readability in dark mode and adjust chart theme variables if needed.

### 4.4 Mobile Responsiveness

**Problem:** The dashboard layout uses `lg:grid-cols-2` for the chart + table and performance sections, which is fine for desktop but the stat cards, chart controls, and performance table headers don't collapse gracefully on mobile.

**Suggestions:**
- Stats cards: Stack to 1-column on mobile.
- Chart filter controls: Stack vertically on small screens instead of horizontal.
- Performance tables: Use a card-based layout on mobile instead of a table (each annotator as a card showing key metrics).

### 4.5 Loading State Mismatch

**Problem:** The skeleton loader for stats cards shows 6 cards (`sm:grid-cols-2 lg:grid-cols-3` grid), but the actual StatsCards component renders 8 cards in a different grid layout (4 + 3+3). The skeleton doesn't match the final layout.

**Suggestion:** Make the skeleton mirror the actual layout: 4 cards in the first row, 6 smaller cards in the second row.

### 4.6 "Avg Ann/Job" and "Avg Review Time" — Not Implemented

**Problem:** Both performance tables show columns for "Avg Ann/Job" and "Avg Review Time" that always display "—" (not yet implemented).

**Suggestion:** Either implement these metrics or remove the columns entirely. Showing perpetual "—" values reduces trust in the dashboard data and wastes horizontal space.

---

## 5. Priority Ranking

| Priority | Suggestion | Impact | Effort |
|----------|-----------|--------|--------|
| P0 | Fix stats card responsiveness (1.1) | High | Low |
| P0 | Fix skeleton/layout mismatch (4.5) | Medium | Low |
| P0 | Remove or implement "Avg" columns (4.6) | Medium | Low |
| P1 | Color-code bars by status (1.5) | High | Low |
| P1 | Add annotator/QA personal stats cards (2.1, 3.1) | High | Medium |
| P1 | Outcome card color tints (1.2) | Medium | Low |
| P1 | Round percentages (1.3) | Low | Trivial |
| P1 | Consistent date formatting (1.7) | Low | Low |
| P2 | Merge duplicate quick action buttons (1.12) | Low | Trivial |
| P2 | Add refresh button + timestamp (1.13) | Medium | Low |
| P2 | Debounced search (2.2) | Medium | Low |
| P2 | Performance table column toggles (1.9) | Medium | Medium |
| P2 | Performance table CSV export (4.2) | Medium | Medium |
| P2 | Clickable row visual cue (1.11) | Low | Low |
| P3 | Pipeline funnel visualization (1.14) | High | High |
| P3 | Donut chart toggle (1.6) | Medium | Medium |
| P3 | Acceptance % inline bar (1.10) | Medium | Medium |
| P3 | Mobile card layout for tables (4.4) | Medium | High |
| P3 | Keyboard shortcuts (4.1) | Low | Medium |
| P3 | Blind review indicator (3.2) | Low | Low |
| P3 | Job age/urgency indicators (2.3) | Medium | Medium |
