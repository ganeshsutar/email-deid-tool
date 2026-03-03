# Datasets Feature — UI/UX Improvement Plan

Comprehensive audit of `admin/datasets/` routes and all related components.

---

## 1. Datasets List Page (`routes/admin/datasets/index.tsx`)

### 1.1 No Filtering Options Beyond Search
- Only a text search (`Search datasets...`) is available.
- **Missing filters**: status (UPLOADING / EXTRACTING / READY / FAILED), upload date range, uploaded-by user.
- Hard to find specific datasets in a large list without these.

### 1.2 Bulk "Delete Selected" Only Deletes One Dataset
- `Delete Selected (N)` button appears when multiple datasets are checked (line 106–119), but the handler picks only the **first** matching dataset and opens a single-item delete dialog:
  ```ts
  const target = datasets.find((d) => selectedIds.has(d.id));
  if (target) setDeleteTarget(target);
  ```
- True bulk dataset deletion is not implemented — misleading UI.

### 1.3 Progress Bar Only Shows Delivery Percentage
- Progress column (lines 176–189) calculates `delivered / fileCount` only.
- No indication of how many jobs are in annotation, QA, rejected, etc.
- **Improvement**: Use a stacked/segmented progress bar or add a tooltip showing breakdown by status.

### 1.4 Inconsistent Empty State
- When there are no datasets, a plain text `"No datasets found."` is rendered inside a `<TableCell>`.
- The jobs table in the detail page uses the proper `<EmptyState>` component with an icon.
- Should be consistent — use `<EmptyState>` everywhere.

### 1.5 Date Formatting
- Uses `toLocaleDateString()` which gives locale-dependent output (e.g., `12/24/2024`).
- Dashboard uses `formatDistanceToNow` (relative dates). Pick one convention and stick with it, or show relative with absolute on hover.

### 1.6 No Sorting
- Table headers are not clickable/sortable.
- Users cannot sort by name, date, file count, or progress.

### 1.7 Missing Columns
- `updatedAt` / last-modified date not shown.
- `duplicateCount` and `excludedCount` are fetched by the API but never surfaced in the list view.
- When status is `FAILED`, the error message is not visible — no tooltip or indicator.

### 1.8 Row Click + Actions Column Overlap
- Entire row is clickable (`cursor-pointer`, navigates to detail page).
- Actions column uses `e.stopPropagation()` to prevent navigation, but the download dropdown and delete button are small — easy to mis-click on mobile.

---

## 2. Dataset Detail Page (`routes/admin/datasets/$id.tsx`)

### 2.1 Excessive `useState` — 20 State Variables
- The component has **20 separate `useState` calls** (lines 58–76) for managing dialogs, filters, selections, and viewer state.
- Hard to maintain and reason about. Should be consolidated with a reducer or extracted into custom hooks.

### 2.2 Loading State Is Plain Text
- `datasetLoading` shows `"Loading..."` in muted text (line 219) instead of a proper skeleton or spinner.
- Inconsistent with the rest of the app which uses `<TableSkeleton>` and `<Skeleton>` components.

### 2.3 Status Cards Grid — Extreme Column Jump
- `grid-cols-3 sm:grid-cols-5 lg:grid-cols-10` (dataset-status-cards.tsx line 40).
- On desktop, 10 tiny columns with very small text. On mobile, 3 wide columns.
- The jump from 5 → 10 columns at `lg` breakpoint is too aggressive. Cards become hard to read.
- **Improvement**: Cap at 5 or 6 columns with wrapping, or use a scrollable horizontal row on mobile.

### 2.4 Status Cards — Color-Only Differentiation
- Each card uses a small colored dot (`h-2 w-2 rounded-full`) to indicate status.
- Relies entirely on color — problematic for colorblind users.
- **Improvement**: Add icons or pattern-based indicators alongside the dot.

### 2.5 Search + Bulk Actions Bar Crowding
- When jobs are selected + a status filter is active, 4 items appear on one line: search input, "Clear Filter" button, "Reset Selected" button, "Delete Selected" button.
- Can overflow on smaller screens. No wrapping strategy.

### 2.6 Email Viewer Dialog — Mobile Issues
- Dialog uses `sm:max-w-4xl max-h-[85vh]` (line 340) — very large.
- On mobile, the tabs, resizable panels, and content are all cramped.
- The annotated tab uses `ResizablePanelGroup` which isn't practical on small screens.
- **Improvement**: Use a full-screen sheet/drawer on mobile, collapse panels to tabs.

### 2.7 Email Viewer Dialog — Missing `aria` Attributes
- No `aria-label` on the dialog.
- Content area lacks `role="document"`.
- History tab's "Compare" callback is a no-op: `onCompareVersion={() => {}}`.

### 2.8 `dialogJob` Can Be `null` When Dialog Is Open
- `dialogJob` is found via `jobs.find(j => j.id === dialogJobId)` (line 213–215).
- If the user paginates while the dialog is open, the job disappears from the current page's `jobs` array, and `dialogJob` becomes `undefined`, breaking the dialog header.

### 2.9 Selection State Persists Across Pages
- `selectedJobIds` (line 63) is a `Set<string>` that survives pagination.
- Users can select jobs on page 1, go to page 2, select more — but there's no visual count of total selections across pages.
- Bulk delete/reset only operates on jobs visible on the current page (filtered by `jobs.filter(j => selectedJobIds.has(j.id))`), so off-page selections are silently ignored.
- **Improvement**: Show "X selected across all pages" indicator, or scope selection to current page only.

---

## 3. Dataset Jobs Table (`components/dataset-jobs-table.tsx`)

### 3.1 Too Many Action Buttons Per Row
- Each row can show up to 5 icon buttons: View, History, Download, Reset, Delete.
- All packed into a single `div` with `gap-1`.
- On smaller screens, this forces horizontal scroll or truncation.
- **Improvement**: Use a dropdown menu for secondary actions (History, Download, Reset). Keep only View and Delete as direct buttons.

### 3.2 Redundant `TooltipProvider` Per Button
- Each button is wrapped in its own `<TooltipProvider>` (5 separate providers per row).
- Should use a single `<TooltipProvider>` wrapping the entire actions cell or the table.

### 3.3 Tooltips Not Keyboard Accessible
- Tooltips only appear on hover, not on focus.
- Icon-only buttons lack `aria-label` — screen readers get no information.
- **Improvement**: Add `aria-label` to each icon button as a fallback.

### 3.4 No Column Sorting
- Headers are static. No ability to sort by filename, status, annotator, QA, or update date.

---

## 4. Upload Dialog (`components/dataset-upload-dialog.tsx`)

### 4.1 No Retry on Failure
- Error stage shows an error message and a "Close" button (lines 147–167).
- No "Retry" button — user must close and reopen the dialog, losing the dataset name they typed.
- **Improvement**: Add a "Try Again" button that resets to the form stage while preserving the name.

### 4.2 No Progress Indication During Extraction
- Upload stage shows a percentage progress bar.
- Extraction stage only shows a spinner with `"Extracting email files... This may take a moment."`.
- No estimated time, no indication of how long it will take.

### 4.3 After Success, Dialog Stays Open
- User must click "Done" to close (line 141).
- Could auto-close after a short delay or navigate to the new dataset detail page.

### 4.4 Side-Effect in Render
- Lines 62–72: polling result is processed by calling `setStage`/`setFileCount`/etc. directly during render (not in a `useEffect`).
- This causes React to re-render twice and is considered an anti-pattern.

### 4.5 Dataset Name Validation
- No character limit shown.
- No uniqueness check (API will fail, but no preemptive feedback).
- Placeholder `"e.g. Batch 2024-01"` is helpful but no validation rules are communicated.

---

## 5. File Drop Zone (`components/file-drop-zone.tsx`)

### 5.1 Silent Rejection of Non-ZIP Files
- Drag-and-drop only accepts `.zip` (line 41: `droppedFile.name.endsWith(".zip")`), but if a user drops a non-zip file, nothing happens — no error toast, no feedback.
- **Improvement**: Show an error message like "Only .zip files are accepted".

### 5.2 No File Size Limit
- No client-side file size validation. A user could try to upload a 10GB file and only find out it fails after a long wait.
- **Improvement**: Add a max size check and display the limit (e.g., "Max 500MB").

### 5.3 Missing Keyboard Accessibility
- The drop zone is a `<div>` with `onClick` but no `role="button"`, `tabIndex`, or `onKeyDown` handler.
- Keyboard-only users cannot trigger the file picker.

---

## 6. Delete Confirm Dialog (`components/dataset-delete-confirm-dialog.tsx`)

### 6.1 No Mention of Annotations/History Being Deleted
- Dialog says "all N associated jobs" but doesn't mention that annotations, QA reviews, and version history will also be destroyed.
- **Improvement**: Add a breakdown: "This will delete: X jobs, Y annotations, Z QA reviews".

### 6.2 Confirm Text State Not Reset on Re-open
- `confirmText` is reset when the dialog closes (`if (!val) setConfirmText("")`), but if the dialog is rapidly toggled, stale text can persist.

---

## 7. Job Delete Confirm Dialog (`components/job-delete-confirm-dialog.tsx`)

### 7.1 No Partial Success Handling
- Bulk delete calls `deleteJobs.mutateAsync({ jobIds, force })` — if some succeed and some fail, there's no indication.
- Toast just says generic success/error.
- **Improvement**: Show "Deleted X of Y jobs. Z failed." in the toast.

### 7.2 `force` Flag Automatically Set
- When `hasInProgress` is true, the warning is shown, but clicking "Delete" sends `force: true` automatically.
- Consider requiring an explicit checkbox: "I understand in-progress work will be lost".

---

## 8. Job Reset Confirm Dialog (`components/job-reset-confirm-dialog.tsx`)

### 8.1 "Reset to Uploaded" Terminology Is Unclear
- Users may not know what "Uploaded" status means in the workflow.
- **Improvement**: Show current status → new status transition (e.g., "QA Accepted → Uploaded") and explain briefly what happens next ("Job will be available for re-assignment").

### 8.2 No Partial Success Handling for Bulk Reset
- Same issue as bulk delete — no feedback on partial failures.

---

## 9. Status Badge (`components/status-badge.tsx`)

### 9.1 Hard-Coded Light Mode Colors
- All badge classes use light-mode colors: `bg-gray-100 text-gray-700`, `bg-blue-100 text-blue-700`, etc.
- In dark mode, these become hard to read (light backgrounds on dark surfaces).
- **Improvement**: Add dark mode variants or use theme-aware color tokens.

### 9.2 Color-Only Distinction
- Badges differentiate statuses purely by color.
- **Improvement**: Add small icons per status (e.g., check for Accepted, clock for In Progress, x for Rejected).

---

## 10. API & Data Layer Issues

### 10.1 `get-datasets.ts` — No Status Filter Support
- `DatasetsParams` only has `page`, `pageSize`, `search` — no `status` field.
- Backend likely supports filtering by status but the frontend never sends it.

### 10.2 Over-broad Query Invalidation
- `delete-jobs.ts` and `reset-jobs.ts` invalidate `["datasets", datasetId, "jobs"]`, `["datasets", datasetId]`, `["jobs"]`, and `["dashboard"]` (4 separate invalidation calls).
- This triggers unnecessary refetches across unrelated views.
- **Improvement**: Narrow invalidation to only the affected queries.

### 10.3 `download-dataset-csv.ts` — No Download Progress
- Large CSV downloads have no progress indicator.
- The API uses `StreamingHttpResponse` for large files, but the frontend shows nothing.

---

## 11. General Design Inconsistencies

### 11.1 Button Size Inconsistency
- Upload button: default size.
- Bulk action buttons: `size="sm"`.
- Dialog buttons: mixed sizes.
- Should standardize based on position (toolbar = sm, dialog footer = default, etc.).

### 11.2 Missing Mobile Responsiveness
- Datasets list table with 8 columns (checkbox + 7 data) is too wide for mobile — forces horizontal scroll.
- Jobs table with 7 columns + up to 5 action buttons is worse.
- **Improvement**: Switch to card-based layout on mobile, or hide less critical columns.

### 11.3 No Breadcrumb Navigation
- Dataset detail page has a "Back to Datasets" link, but no breadcrumb trail.
- When deep in a dialog (viewing email → history → version detail), the navigation hierarchy is lost.

---

## Priority Summary

### High Priority (Functional Bugs / Misleading UI)
1. **Bulk dataset delete is broken** — only deletes first selected item (§1.2)
2. **Dialog job can be null on paginate** — breaks dialog when user changes page (§2.8)
3. **Side-effect in render** — setState during render in upload dialog (§4.4)
4. **Silent drop rejection** — no feedback for non-zip files (§5.1)

### Medium Priority (UX Improvements)
5. Add dataset list filtering by status/date/user (§1.1)
6. Add upload retry button on failure (§4.1)
7. Consolidate action buttons into dropdown menu (§3.1)
8. Fix selection persistence across pages (§2.9)
9. Add stacked progress bar or status tooltip (§1.3)
10. Improve loading state for dataset detail page (§2.2)
11. Fix dark mode badge colors (§9.1)
12. Add `aria-label` to icon-only buttons (§3.3)

### Low Priority (Polish)
13. Standardize empty states across list/detail pages (§1.4)
14. Add column sorting to tables (§1.6, §3.4)
15. Reduce excessive state variables with useReducer (§2.1)
16. Show duplicate/excluded counts in dataset list (§1.7)
17. Narrow query invalidation scope (§10.2)
18. File size validation on drop zone (§5.2)
19. Consistent date formatting across app (§1.5)
20. Mobile responsive table → card layout (§11.2)
