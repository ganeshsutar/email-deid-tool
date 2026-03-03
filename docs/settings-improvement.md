# Settings Page Improvement Suggestions

Analysis of the admin Settings route (`frontend/src/app/routes/admin/settings.tsx`) with actionable improvement recommendations.

---

## 1. Excluded Hashes — No SHA-256 Validation

**Problem:** The hash input field (line 386–396) accepts any text. There's no client-side validation that the entered value is a valid 64-character hexadecimal SHA-256 hash. Users can submit `hello` or a partial hash, and the erro
      r only surfaces from the backend.

**Suggestion:**
- Add a regex check: `/^[a-f0-9]{64}$/i`
- Show inline validation feedback below the input (e.g., "Must be a 64-character hex string")
- Disable the "Add" button until the hash passes validation
- Consider adding a character counter (e.g., `12/64`) to guide manual entry

---

## 2. Excluded Hashes — No Delete Confirmation

**Problem:** Clicking the trash icon (line 488–496) immediately deletes a hash with no confirmation dialog. One mis-click permanently removes a blocklist entry.

**Suggestion:**
- Add an `AlertDialog` confirmation before deletion: "Remove this hash from the blocklist? Files matching this hash will no longer be blocked during upload."
- Show the truncated hash in the dialog so the user can verify

---

## 3. Excluded Hashes — Missing `aria-label` on Icon Buttons

**Problem:** The delete button (line 488–496) and pagination buttons (lines 510–527) are icon-only with no accessible label. Screen readers will announce them as unlabeled buttons.

**Suggestion:**
- Delete button: `aria-label="Remove hash"`
- Previous page: `aria-label="Previous page"`
- Next page: `aria-label="Next page"`

---

## 4. Excluded Hashes — Hash Display Lacks Copy Action

**Problem:** The table truncates hashes to 16 characters with a tooltip for the full value (line 469–476). Users who need to copy a hash must hover, then manually try to select from the tooltip — which is nearly impossible.

**Suggestion:**
- Add a "copy to clipboard" button or make the truncated hash clickable to copy the full value
- Show a brief "Copied!" toast or inline feedback on click

---

## 5. Excluded Hashes — CSV Import Has No Client-Side Feedback for Edge Cases

**Problem:** The CSV import (line 321–354) silently handles several edge cases:
- Non-CSV files (e.g., `.png` renamed to `.csv`) will parse as garbage
- Empty files produce no user feedback
- No file size limit — a 100MB CSV will be fully loaded into memory
- Invalid hash values in rows are sent to the backend without validation

**Suggestion:**
- Validate file size client-side (e.g., max 5MB)
- Validate that parsed hashes match the SHA-256 format before sending
- Show a preview step: "Found 142 hashes in file. 3 rows had invalid format and will be skipped. Proceed?"
- Toast an error if 0 valid items are parsed

---

## 6. Excluded Hashes — Table Not Mobile Responsive

**Problem:** The 5-column table (Hash, Filename, Note, Added, Delete) doesn't adapt to small screens. On mobile, columns will be crushed or overflow horizontally.

**Suggestion:**
- On small screens, switch to a stacked card layout or hide the "Note" and "Added" columns
- Use `hidden sm:table-cell` on lower-priority columns
- Alternatively, use a responsive card list below `md` breakpoint

---

## 7. Discard Reasons — Delete Button Has No Explanation When Disabled

**Problem:** When only 1 reason remains, the trash button (line 220–229) is disabled, but there's no tooltip or text explaining why. The user sees a grayed-out button with no context.

**Suggestion:**
- Wrap the disabled button in a `Tooltip` that says "At least one reason is required"
- Or show a small helper text below the list: "Minimum 1 reason required"

---

## 8. Discard Reasons — No Duplicate Detection Feedback

**Problem:** The `handleAddReason` function (line 99–105) silently ignores duplicate entries (`!localReasons.includes(trimmed)`). The input clears, and the user gets no feedback that their entry was a duplicate.

**Suggestion:**
- Show a toast or inline message: "This reason already exists"
- Don't clear the input on duplicate, so the user can see what they typed

---

## 9. Discard Reasons — No Reordering Support

**Problem:** Discard reasons are displayed in insertion order with no way to reorder them. If the admin wants "Other" to always be last or wants to prioritize frequently-used reasons, they must delete and re-add.

**Suggestion:**
- Add drag-to-reorder handles (using `@dnd-kit/core` or similar)
- Or add simple up/down arrow buttons next to each reason

---

## 10. Min Annotation Length — No Visible Validation Boundary

**Problem:** The number input (line 179–189) clamps to `min=1` via `Math.max(1, ...)`, but there's no upper bound. A user could set it to 999999. There's also no visual feedback when the value is at the minimum boundary.

**Suggestion:**
- Add a reasonable upper bound (e.g., 100 or 500) and show it: "Must be between 1 and 500"
- Show the current server value as reference: "Currently set to: 3"

---

## 11. Blind Review Toggle — No Undo/Confirmation

**Problem:** The blind review switch (line 147–153) fires the API mutation immediately on toggle (`onCheckedChange={handleToggle}`). There's no confirmation, and accidental toggles can't be undone without toggling again.

**Suggestion:**
- For a setting this impactful (affects all QA reviewers), consider adding a confirmation dialog: "Enable blind review mode? QA reviewers will no longer see annotator names."
- Or adopt the same Save-button pattern used by min annotation length, so the toggle is local until explicitly saved

---

## 12. Page Structure — All Settings in a Single Long Scroll

**Problem:** The page has 4 cards stacked vertically. As more settings are added, this will become an unwieldy scroll. Users looking for a specific setting must scroll through everything.

**Suggestion:**
- Add a sidebar navigation or tab-based layout grouping settings by category (e.g., "QA Settings", "Validation", "Blocklist")
- Or add anchor links at the top for quick jumps to each section
- Consider a sticky header with section indicators

---

## 13. Loading States — Inconsistent Skeleton Treatment

**Problem:** Only the excluded hashes table has a proper skeleton loader (`TableSkeleton`). The blind review, min annotation length, and discard reasons sections show no loading state — their controls render with default/empty val
      ues before data arrives (e.g., switch defaults to `false`, min length to `1`).

**Suggestion:**
- Add skeleton loaders for each card's content area while its data is loading
- Or disable all controls and show a subtle "Loading..." indicator per section
- This prevents the flash of incorrect default values

---

## 14. Discard Reasons — Empty State When Loading

**Problem:** When `discardReasonsData` is loading, `localReasons` is `[]` (line 77), so the list appears empty momentarily before the data arrives. This creates a flash of empty content.

**Suggestion:**
- Show a skeleton or "Loading reasons..." placeholder while `discardReasonsLoading` is true
- Only render the editable list once data has arrived

---

## 15. No Unsaved Changes Warning

**Problem:** If the user modifies discard reasons or min annotation length but navigates away without saving, changes are silently lost. There's no "You have unsaved changes" prompt.

**Suggestion:**
- Use TanStack Router's `beforeLoad` or a `beforeunload` event listener to warn about unsaved changes
- Show a subtle "Unsaved changes" badge near the Save button

---

## 16. Excluded Hashes — Pagination Outside TooltipProvider

**Problem:** The pagination controls (lines 504–530) are inside the `<TooltipProvider>` block but outside the `<Table>`. While this works, the `TooltipProvider` wrapping is broader than needed. More importantly, if the table is em
      pty (`data.count === 0`), the entire table + pagination block is replaced by `EmptyState`, so filtered searches that return 0 results lose the search context.

**Suggestion:**
- When search is active and returns 0 results, show "No hashes match your search" instead of the generic empty state
- Keep the search bar visible regardless of results

---

## Summary — Priority Order

| Priority | Issue | Impact |
|----------|-------|--------|
| High | #1 SHA-256 validation | Data integrity — invalid hashes pollute blocklist |
| High | #2 Delete confirmation | Data loss — accidental deletion |
| High | #5 CSV import validation | Data integrity + UX — silent failures |
| Medium | #3 Missing aria-labels | Accessibility |
| Medium | #7 Disabled delete no explanation | UX confusion |
| Medium | #8 Duplicate reason no feedback | UX — silent ignore |
| Medium | #11 Blind review no confirmation | Accidental setting change |
| Medium | #13 Inconsistent loading states | Visual flash of wrong defaults |
| Medium | #14 Discard reasons empty flash | Visual glitch |
| Medium | #15 No unsaved changes warning | Silent data loss |
| Low | #4 Hash copy to clipboard | Convenience |
| Low | #6 Table mobile responsiveness | Mobile usability |
| Low | #9 Reason reordering | Nice-to-have |
| Low | #10 Min length upper bound | Edge case |
| Low | #12 Long scroll page structure | Scalability |
| Low | #16 Empty search state | Minor UX |