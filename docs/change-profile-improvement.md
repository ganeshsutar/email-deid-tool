# Change Profile — Component Analysis & Improvement Suggestions

## Current State

There is **no unified "Change Profile" dialog**. Profile-related actions are scattered across multiple components:

| Action | Location | Component |
|--------|----------|-----------|
| View name/email | User dropdown header | `user-dropdown.tsx`, `sidebar-user.tsx` |
| Change avatar | Dialog launched from dropdown | `avatar-change-dialog.tsx` |
| Change password (self) | Full-page route `/change-password` | `change-password-form.tsx` |
| Change password (admin) | Dialog in admin users table | `change-password-dialog.tsx` |
| Theme/style prefs | Sub-menus in dropdown | `user-dropdown.tsx`, `sidebar-user.tsx` |

### Files Involved

- `frontend/src/components/layouts/user-dropdown.tsx` — Top-nav dropdown (annotator/QA)
- `frontend/src/components/layouts/sidebar-user.tsx` — Sidebar dropdown (admin), **~90% identical** to user-dropdown
- `frontend/src/components/avatar-change-dialog.tsx` — DiceBear avatar customization dialog
- `frontend/src/components/user-avatar.tsx` — Avatar display component
- `frontend/src/features/auth/components/change-password-form.tsx` — Full-page password change
- `frontend/src/features/users/components/change-password-dialog.tsx` — Admin password reset dialog
- `frontend/src/features/auth/api/update-avatar.ts` — Avatar mutation hook
- `frontend/src/features/auth/api/change-password.ts` — Self password change mutation
- `frontend/src/lib/avatar.ts` — DiceBear URL builder + option constants

---

## Issues & Improvement Opportunities

### 1. Massive Code Duplication Between Dropdowns

**Problem**: `user-dropdown.tsx` (234 lines) and `sidebar-user.tsx` (271 lines) share ~90% identical code — the same theme sub-menus (style, theme mode, neutral color, base color, radius), avatar dialog trigger, change password link, and logout handler are duplicated verbatim.

**Suggestion**: Extract shared dropdown content into a reusable component (e.g., `UserMenuContent`) that both `UserDropdown` and `SidebarUser` consume. Only the trigger element and layout wrapper differ between them.

---

### 2. No Unified Profile Page or Dialog

**Problem**: Users cannot view or edit their profile information (name, email) in one place. The name/email are read-only in the dropdown header. To change their avatar they open one dialog; to change their password they navigate to an entirely different full-page route. There is no way for users to update their display name at all.

**Suggestion**: Create a unified "Profile" dialog or page with tabs/sections:
- **Profile info** — Display and (optionally) edit name
- **Avatar** — Current avatar change dialog content
- **Password** — Inline password change form (instead of navigating away)
- **Appearance** — Theme/style preferences (currently buried in nested sub-menus)

---

### 3. Theme Settings Overload the User Dropdown

**Problem**: Five nested sub-menus (Style, Theme, Neutral Color, Base Color, Radius) dominate the dropdown, making it feel like a settings panel rather than a quick user menu. Each requires hover → navigate → select, which is clunky for exploration.

**Suggestion**: Move theme/appearance settings out of the dropdown into:
- A dedicated "Appearance" tab in the profile dialog, or
- The existing `/admin/settings` page (for admin), or
- A small popover/sheet triggered by a single "Appearance" item in the dropdown

This simplifies the dropdown to: user info, Change Profile, Log Out.

---

### 4. Avatar Dialog — No Loading/Error States for External Images

**Problem**: The avatar preview and grid load images from `api.dicebear.com`. If the CDN is slow or unreachable, images silently fail with broken `<img>` tags. There are no loading skeletons or error fallbacks.

**Suggestion**:
- Add `onLoad`/`onError` handlers to avatar `<img>` elements
- Show skeleton placeholders while images load
- Display a fallback (initials or placeholder icon) on error
- Consider caching/preloading the 12 random avatar thumbnails

---

### 5. Avatar Dialog — Config Doesn't Reset on Re-open After Save

**Problem**: `useState` for `config` is initialized once with `useMemo(defaultConfig)`. After saving, `handleOpenChange` resets config on close — but `defaultConfig` is memoized and may not reflect the just-saved value until the component remounts or the query cache updates. This can cause a brief flash of stale state.

**Suggestion**: Use a `key` prop on the dialog content tied to `user.avatarConfig` to force fresh state on re-open, or derive initial state from the latest user data in an effect.

---

### 6. Avatar Dialog — Customize Tab UX

**Problem**:
- Color options display raw hex codes (e.g., `614335`, `a55728`) without meaningful labels — users must guess what color `ae5d29` represents.
- The scroll area is a fixed `h-64` which may be too short on larger screens and forces excessive scrolling through 11 option categories.
- No "Reset to default" button to undo all customizations.
- Selected customization options have no visual preview beyond the single avatar preview — changing one option from a list of 10+ values requires trial and error.

**Suggestion**:
- For color options, show only the color swatch (larger) with a tooltip for the hex code, or use human-readable labels (e.g., "Light Brown", "Dark Brown")
- Add a "Reset" button to clear all customizations back to defaults
- Consider a responsive height for the scroll area
- Group related options (e.g., "Hair" section for top + hairColor, "Face" section for eyes + eyebrows + mouth)

---

### 7. Change Password Form — No Current Password Validation

**Problem**: The self-service change password form (`change-password-form.tsx`) only asks for a new password and confirmation — it does not require the current password. This is a security concern: if a session is hijacked or a user walks away from an unlocked screen, anyone can change the password.

**Suggestion**: Add a "Current Password" field that the backend validates before allowing the change. (Check if the backend `/api/auth/change-password/` already supports this.)

---

### 8. Change Password Form — Weak Validation Feedback

**Problem**:
- No password strength indicator — users don't know if their password meets requirements until they submit and get a backend validation error.
- The confirm password mismatch message appears immediately on first keystroke, which can feel aggressive.
- Error parsing uses verbose inline type assertions instead of a utility function.

**Suggestion**:
- Add a password strength meter (length, complexity indicators)
- Debounce or only show mismatch after confirm field loses focus
- Extract the API error parsing into a shared `getApiErrorMessage` utility (one already exists at `src/lib/api-client.ts` based on the CLAUDE.md — reuse it)

---

### 9. No Profile Edit Capability (Name/Email)

**Problem**: The `User` model has `name` and `email` fields, but there is no UI for users to update their own name. The backend may or may not have an endpoint for this. Users who need their name corrected must ask an admin.

**Suggestion**: Add a "Display Name" editable field in the profile dialog. If the backend doesn't support self-service name update, add a `PATCH /api/auth/me/` endpoint.

---

### 10. Missing Accessibility

**Problem**:
- Avatar grid in `avatar-change-dialog.tsx` uses plain `<button>` elements without `aria-label` — screen readers would announce nothing meaningful.
- No `aria-pressed` or `aria-selected` on the selected avatar option.
- The random seed buttons lack descriptive text.
- Color swatches in theme sub-menus and customize tab are purely visual with no text alternative.

**Suggestion**:
- Add `aria-label="Avatar option {index}"` and `aria-pressed={isSelected}` to avatar grid buttons
- Add `role="radiogroup"` to the avatar grid container and `role="radio"` to each option
- Add `aria-label` with color names to color swatch elements

---

### 11. No Optimistic Update for Avatar

**Problem**: After clicking "Save" in the avatar dialog, the user sees "Saving..." and waits for the API round-trip before the dialog closes and the header avatar updates. The avatar in the dropdown/sidebar doesn't update until the query cache refreshes.

**Suggestion**: Use React Query's `onMutate` for optimistic cache update — immediately update the `["auth", "me"]` query data with the new config, roll back `onError`. This makes the avatar change feel instant.

---

### 12. `buildAvatarUrl` — External CDN Dependency Without Fallback

**Problem**: Every avatar display depends on `api.dicebear.com`. If the CDN goes down, all avatars across the entire application break simultaneously. The `UserAvatar` component has an `AvatarFallback` (initials), but only if the `<img>` fires an error event — which may not happen promptly with slow CDN responses.

**Suggestion**:
- Consider self-hosting DiceBear or using their npm package for SVG generation on the client
- Add a `loading="lazy"` attribute to non-critical avatar images (e.g., in tables)
- Set a reasonable timeout on avatar image loading

---

## Summary — Priority Ranking

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| High | #1 Code duplication (dropdowns) | Maintainability | Medium |
| High | #2 Unified profile dialog | UX coherence | Medium-High |
| High | #7 No current password check | Security | Low |
| Medium | #3 Theme settings overload | UX clarity | Medium |
| Medium | #6 Avatar customize UX | Usability | Medium |
| Medium | #10 Accessibility gaps | Compliance | Low-Medium |
| Medium | #8 Password validation feedback | UX polish | Low |
| Low | #4 Avatar loading/error states | Resilience | Low |
| Low | #5 Avatar config reset timing | Edge-case bug | Low |
| Low | #9 Name/email editing | Feature gap | Medium |
| Low | #11 Optimistic avatar update | Perceived speed | Low |
| Low | #12 CDN dependency | Resilience | High |
