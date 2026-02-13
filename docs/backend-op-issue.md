# Backend EML Normalizer — Partial QP Decoding Bug

## Issue

The `eml_normalizer.py` `_collect_part_replacements()` function (line 154) uses a regex `\r?\n--` to detect MIME boundary endings for encoded body parts. This regex falsely matches HTML comment endings like `----></td>` or `---><!--[if...]>` that appear within the body content.

## Root Cause

**File**: `backend/core/eml_normalizer.py`, line 154
**Regex**: `boundary_pattern = re.compile(r"\r?\n--")`

This pattern matches ANY line starting with `--`, not just MIME boundary lines. In HTML emails, `--` commonly appears inside HTML comments (`<!-- ... -->`), causing the normalizer to detect a false body end.

## Impact

For affected emails (e.g., `data/A000545_t1_1.eml` — DoorDash marketing email):

1. **Body truncation**: The normalizer only decodes the QP content before the false `\n--` match (e.g., line 772) instead of the actual MIME boundary (e.g., line 1310)
2. **CTE header mismatch**: The `Content-Transfer-Encoding` header is changed from `quoted-printable` to `8bit`, but most of the body remains QP-encoded
3. **Frontend rendering artifacts**: The frontend sees CTE `8bit` and skips QP decoding, showing raw QP artifacts like `=3D`, `=\r\n` soft line breaks, and `=XX` hex pairs

The same `\r?\n--` regex is used in `_collect_re_encode_replacements()` (line 702), causing the `re_encode_eml()` function to have the same boundary detection bug.

## Affected Emails

Any email with `Content-Transfer-Encoding: quoted-printable` whose body contains `--` at the start of a line (common in HTML comments). Base64-encoded parts are NOT affected because base64 alphabet doesn't include `-`.

## Example

```
DoorDash email (A000545_t1_1.eml):
- Boundary: 6c04f5e2... (at line 1310)
- False match: line 772 — "----></td>" (HTML comment ending)
- Result: lines 1–771 decoded, lines 772–1310 still QP-encoded
```

## Why Not Fixed Yet

Changing the normalizer's boundary detection would alter the normalized content for emails that have already been annotated. Since annotation offsets are computed against the normalized content, changing the normalization would invalidate all existing annotations for affected emails.

## Correct Fix (Future)

The boundary detection should match the actual MIME boundary string, not any `--` sequence. The fix would be:

```python
# Instead of:
boundary_pattern = re.compile(r"\r?\n--")

# Use the actual boundary from the parent multipart:
boundary_pattern = re.compile(r"\r?\n--" + re.escape(actual_boundary))
```

This requires passing the parent boundary string through the call chain, which is a larger refactor. When implemented, existing annotations would need migration (re-normalizing and adjusting offsets).

## Current Workaround

The frontend preview components work around this by:
1. Using the original raw EML (not normalized) for the Email tab and 0-annotation preview
2. Using a backend `preview-deidentify` API that inverse-maps annotation offsets from normalized space to raw space, then de-identifies the original raw content for the de-identified preview
