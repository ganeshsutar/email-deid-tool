"""
Utility to normalize .eml file content by decoding base64 and quoted-printable
encoded text parts into readable text, preserving MIME structure and offsets.
"""

import bisect
import base64
import email
import email.message
import quopri
import re
from collections.abc import Callable


def normalize_eml(raw_content: str) -> tuple[str, bool]:
    """
    Decode base64/quoted-printable text/* parts in an .eml string.

    Operates at the string level to preserve formatting and structure.
    Returns (normalized_content, has_encoded_parts).
    """
    msg = email.message_from_string(raw_content)

    if not msg.is_multipart():
        return _normalize_single_part(raw_content, msg)

    return _normalize_multipart(raw_content, msg)


def _get_cte(msg: email.message.Message) -> str:
    return (msg.get("Content-Transfer-Encoding") or "").strip().lower()


def _normalize_single_part(
    raw_content: str, msg: email.message.Message
) -> tuple[str, bool]:
    """Handle a non-multipart message."""
    content_type = msg.get_content_type() or ""
    if not content_type.startswith("text/"):
        return raw_content, False

    cte = _get_cte(msg)
    if cte not in ("base64", "quoted-printable"):
        return raw_content, False

    charset = msg.get_content_charset() or "utf-8"

    # Find the body: everything after the first blank line (header/body separator)
    sep_match = re.search(r"\r?\n\r?\n", raw_content)
    if not sep_match:
        return raw_content, False

    body_start = sep_match.end()
    encoded_body = raw_content[body_start:]

    decoded_text = _decode_payload(encoded_body, cte, charset)
    if decoded_text is None:
        return raw_content, True  # decode failed, leave as-is

    # Replace CTE header value and body
    headers = _replace_cte_header(raw_content[:body_start], cte)
    return headers + decoded_text, True


def _normalize_multipart(
    raw_content: str, msg: email.message.Message
) -> tuple[str, bool]:
    """Handle a multipart message by finding and decoding each text/* part."""
    # Collect all (body_start, body_end, decoded_text, cte_header_start, cte_header_end)
    replacements: list[dict] = []
    _collect_part_replacements(raw_content, msg, replacements)

    if not replacements:
        return raw_content, False

    # Apply from end to start to preserve earlier offsets
    replacements.sort(key=lambda r: r["body_start"], reverse=True)
    result = raw_content
    for rep in replacements:
        # Replace body
        result = result[: rep["body_start"]] + rep["decoded_text"] + result[rep["body_end"] :]
        # Replace CTE header (which comes before body, so offset is still valid)
        result = (
            result[: rep["cte_start"]]
            + rep["cte_replacement"]
            + result[rep["cte_end"] :]
        )

    return result, True


def _collect_part_replacements(
    raw_content: str,
    msg: email.message.Message,
    replacements: list[dict],
) -> None:
    """Recursively collect replacement info for encoded text/* parts."""
    if msg.is_multipart():
        for part in msg.get_payload():
            _collect_part_replacements(raw_content, part, replacements)
        return

    content_type = msg.get_content_type() or ""
    if not content_type.startswith("text/"):
        return

    cte = _get_cte(msg)
    if cte not in ("base64", "quoted-printable"):
        return

    charset = msg.get_content_charset() or "utf-8"

    # Find this part in the raw content using its encoded payload as anchor
    payload = msg.get_payload(decode=False)
    if not payload or not isinstance(payload, str):
        return

    # The encoded payload (as stored by the email parser) should appear in raw_content.
    # Trim to get a reliable search substring.
    payload_stripped = payload.strip()
    if not payload_stripped:
        return

    # Use first and last lines of payload to create a unique search pattern
    payload_lines = payload_stripped.split("\n")
    # Use a chunk from the start for matching (first few lines should be unique enough)
    search_chunk = "\n".join(payload_lines[:3]).strip()
    if not search_chunk:
        return

    # Find where this encoded content starts in raw_content
    chunk_pos = raw_content.find(search_chunk)
    if chunk_pos == -1:
        # Try with \r\n line endings
        search_chunk_crlf = "\r\n".join(payload_lines[:3]).strip()
        chunk_pos = raw_content.find(search_chunk_crlf)
        if chunk_pos == -1:
            return

    # Body start is at chunk_pos (or slightly before if there's leading whitespace)
    # Search backwards for the blank line separator
    before_chunk = raw_content[:chunk_pos]
    # Find the last blank line before the encoded content
    blank_match = None
    for m in re.finditer(r"\r?\n\r?\n", before_chunk):
        blank_match = m
    if not blank_match:
        return

    body_start = blank_match.end()

    # Find body end: next MIME boundary or end of content
    # Look for boundary line after body
    boundary_pattern = re.compile(r"\r?\n--")
    body_end_match = boundary_pattern.search(raw_content, chunk_pos + len(search_chunk))
    if body_end_match:
        body_end = body_end_match.start()
    else:
        body_end = len(raw_content)

    encoded_body = raw_content[body_start:body_end]
    decoded_text = _decode_payload(encoded_body, cte, charset)
    if decoded_text is None:
        return

    # Find the CTE header line in the part headers (between boundary and blank line)
    header_section = raw_content[before_chunk.rfind("\n--") : body_start] if "\n--" in before_chunk else before_chunk
    # More precisely: headers are between the last boundary before body_start and body_start
    cte_pattern = re.compile(
        r"Content-Transfer-Encoding:\s*" + re.escape(cte.strip()),
        re.IGNORECASE,
    )
    # Search in the region before body_start — take the LAST match
    # (closest to the body) to avoid hitting a parent multipart container's CTE.
    header_region_start = max(0, body_start - 500)  # headers shouldn't be more than 500 chars
    header_region = raw_content[header_region_start:body_start]
    cte_match = None
    for m in cte_pattern.finditer(header_region):
        cte_match = m
    if not cte_match:
        return

    cte_abs_start = header_region_start + cte_match.start()
    cte_abs_end = header_region_start + cte_match.end()

    # Check this replacement doesn't overlap with existing ones
    for existing in replacements:
        if (body_start < existing["body_end"] and body_end > existing["body_start"]):
            return  # overlapping, skip

    replacements.append({
        "body_start": body_start,
        "body_end": body_end,
        "decoded_text": decoded_text,
        "cte_start": cte_abs_start,
        "cte_end": cte_abs_end,
        "cte_replacement": f"Content-Transfer-Encoding: 8bit",
    })


def _decode_payload(encoded_text: str, cte: str, charset: str) -> str | None:
    """Decode base64 or quoted-printable encoded text. Returns None on failure."""
    try:
        stripped = encoded_text.strip()
        if not stripped:
            return ""

        if cte == "base64":
            decoded_bytes = base64.b64decode(stripped)
        elif cte == "quoted-printable":
            decoded_bytes = quopri.decodestring(
                stripped.encode("ascii", errors="replace")
            )
        else:
            return None

        return decoded_bytes.decode(charset, errors="replace")
    except Exception:
        return None


def _replace_cte_header(header_text: str, old_cte: str) -> str:
    """Replace Content-Transfer-Encoding header value with '8bit'."""
    pattern = re.compile(
        r"(Content-Transfer-Encoding:\s*)" + re.escape(old_cte),
        re.IGNORECASE,
    )
    return pattern.sub(r"\g<1>8bit", header_text)


# ---------------------------------------------------------------------------
# Raw → normalized offset mapping
# ---------------------------------------------------------------------------


def _is_hex_char(c: str) -> bool:
    """Check if a character is a valid hexadecimal digit."""
    return c in "0123456789ABCDEFabcdef"


def _build_qp_offset_table(
    raw_stripped_body: str, charset: str = "utf-8"
) -> list[int]:
    """
    Build a character-level offset table for QP-encoded body text.

    Maps each position in the raw (QP-encoded, \\r-stripped) body to the
    corresponding position in the decoded (\\r-stripped) body string.

    Accounts for multi-byte charsets (e.g. UTF-8) where multiple QP hex pairs
    (like =E2=80=A2) decode to a single Unicode character.

    Returns a list of length len(raw_stripped_body) + 1 where
    table[i] = decoded character position for raw position i.
    """
    body = raw_stripped_body
    body_len = len(body)

    # Pass 1: build byte-level table (raw position → decoded byte position)
    byte_table = [0] * (body_len + 1)
    i = 0
    byte_pos = 0

    while i < body_len:
        byte_table[i] = byte_pos

        if body[i] == "=":
            if i + 1 < body_len and body[i + 1] == "\n":
                # Soft line break → 0 decoded bytes
                byte_table[i + 1] = byte_pos
                i += 2
            elif (
                i + 2 < body_len
                and _is_hex_char(body[i + 1])
                and _is_hex_char(body[i + 2])
            ):
                # Hex pair =XX → 1 decoded byte
                byte_table[i + 1] = byte_pos
                byte_table[i + 2] = byte_pos
                i += 3
                byte_pos += 1
            else:
                # Malformed or trailing =, treat as literal byte
                i += 1
                byte_pos += 1
        else:
            # Regular ASCII character → 1 decoded byte
            i += 1
            byte_pos += 1

    byte_table[body_len] = byte_pos

    # Pass 2: decode bytes and build byte→char mapping
    decoded_bytes = quopri.decodestring(body.encode("ascii", errors="replace"))
    decoded_str = decoded_bytes.decode(charset, errors="replace")

    byte_to_char = [0] * (len(decoded_bytes) + 1)
    char_idx = 0
    bp = 0
    for ch in decoded_str:
        ch_byte_len = len(ch.encode(charset, errors="replace"))
        for _ in range(ch_byte_len):
            if bp < len(byte_to_char):
                byte_to_char[bp] = char_idx
            bp += 1
        char_idx += 1
    # Fill end sentinel
    while bp <= len(decoded_bytes):
        if bp < len(byte_to_char):
            byte_to_char[bp] = char_idx
        bp += 1

    # Pass 3: compose byte_table with byte_to_char
    table = [0] * (body_len + 1)
    for i in range(body_len + 1):
        b = min(byte_table[i], len(decoded_bytes))
        table[i] = byte_to_char[b] if b < len(byte_to_char) else char_idx

    return table


def _to_stripped_offset(pos: int, cr_positions: list[int]) -> int:
    """Convert a position in the original string to the \\r-stripped position."""
    count = bisect.bisect_left(cr_positions, pos)
    return pos - count


def _build_single_part_replacement(
    raw_content: str, msg: email.message.Message
) -> dict | None:
    """Build replacement info for a single-part encoded text/* message."""
    content_type = msg.get_content_type() or ""
    if not content_type.startswith("text/"):
        return None

    cte = _get_cte(msg)
    if cte not in ("base64", "quoted-printable"):
        return None

    charset = msg.get_content_charset() or "utf-8"

    sep_match = re.search(r"\r?\n\r?\n", raw_content)
    if not sep_match:
        return None

    body_start = sep_match.end()
    body_end = len(raw_content)
    encoded_body = raw_content[body_start:body_end]

    decoded_text = _decode_payload(encoded_body, cte, charset)
    if decoded_text is None:
        return None

    # Search entire header section for CTE header
    header_section = raw_content[:body_start]
    cte_pattern = re.compile(
        r"Content-Transfer-Encoding:\s*" + re.escape(cte.strip()),
        re.IGNORECASE,
    )
    cte_match = cte_pattern.search(header_section)
    if not cte_match:
        return None

    return {
        "body_start": body_start,
        "body_end": body_end,
        "decoded_text": decoded_text,
        "cte_start": cte_match.start(),
        "cte_end": cte_match.end(),
        "cte_replacement": "Content-Transfer-Encoding: 8bit",
    }


def build_raw_to_normalized_offset_map(
    raw_content: str,
) -> tuple[str, Callable[[int], int]]:
    """
    Build a mapping function from raw-stripped offsets to normalized-stripped offsets.

    Returns (norm_stripped, map_fn) where:
    - norm_stripped is normalize_eml(raw_content)[0] with \\r removed
    - map_fn(raw_stripped_offset) -> norm_stripped_offset
    """
    normalized, has_encoded = normalize_eml(raw_content)
    norm_stripped = normalized.replace("\r", "")

    if not has_encoded:
        return norm_stripped, lambda offset: offset

    # Collect replacement segments
    msg = email.message_from_string(raw_content)
    replacements: list[dict] = []

    if msg.is_multipart():
        _collect_part_replacements(raw_content, msg, replacements)
    else:
        # Handle single-part messages directly (like _normalize_single_part)
        # _collect_part_replacements uses a 500-char header search window that
        # can be too small for emails with many headers.
        rep = _build_single_part_replacement(raw_content, msg)
        if rep is not None:
            replacements.append(rep)

    if not replacements:
        return norm_stripped, lambda offset: offset

    raw_stripped = raw_content.replace("\r", "")

    # Precompute \r positions for coordinate conversion
    cr_positions = [i for i, c in enumerate(raw_content) if c == "\r"]

    # Sort by body_start ascending
    replacements.sort(key=lambda r: r["body_start"])

    # Build event list (CTE header change, body change) sorted by position
    events = []
    for rep in replacements:
        rs_cte_start = _to_stripped_offset(rep["cte_start"], cr_positions)
        rs_cte_end = _to_stripped_offset(rep["cte_end"], cr_positions)
        rs_body_start = _to_stripped_offset(rep["body_start"], cr_positions)
        rs_body_end = _to_stripped_offset(rep["body_end"], cr_positions)

        decoded_stripped = rep["decoded_text"].replace("\r", "")

        # Detect CTE type from raw content
        cte_text = raw_content[rep["cte_start"] : rep["cte_end"]].lower()
        is_qp = "quoted-printable" in cte_text

        # Build QP offset table for QP parts.
        # _decode_payload strips leading/trailing whitespace before decoding,
        # so the QP table must be built on the stripped content only.
        qp_map = None
        content_start_in_body = 0
        content_end_in_body = rs_body_end - rs_body_start
        if is_qp:
            raw_body = raw_stripped[rs_body_start:rs_body_end]
            content_start_in_body = len(raw_body) - len(raw_body.lstrip())
            raw_body_content = raw_body.strip()
            content_end_in_body = content_start_in_body + len(raw_body_content)
            # Detect charset from Content-Type header near CTE header
            ct_region = raw_content[
                max(0, rep["cte_start"] - 300) : rep["cte_start"] + 300
            ]
            ct_match = re.search(
                r"charset=[\"']?([^\"';\s]+)", ct_region, re.IGNORECASE
            )
            charset = ct_match.group(1) if ct_match else "utf-8"
            qp_map = _build_qp_offset_table(raw_body_content, charset)

        events.append(
            {
                "type": "cte",
                "start": rs_cte_start,
                "end": rs_cte_end,
                "replacement_len": len(rep["cte_replacement"]),
            }
        )
        events.append(
            {
                "type": "body",
                "start": rs_body_start,
                "end": rs_body_end,
                "decoded_stripped_len": len(decoded_stripped),
                "qp_map": qp_map,
                "content_start": content_start_in_body,
                "content_end": content_end_in_body,
            }
        )

    events.sort(key=lambda e: e["start"])

    def map_fn(raw_offset: int) -> int:
        cumulative_delta = 0
        for event in events:
            if raw_offset < event["start"]:
                return raw_offset - cumulative_delta

            if event["type"] == "cte":
                if raw_offset < event["end"]:
                    # Inside CTE header — snap to start in normalized
                    return event["start"] - cumulative_delta
                cte_delta = (
                    (event["end"] - event["start"]) - event["replacement_len"]
                )
                cumulative_delta += cte_delta

            elif event["type"] == "body":
                if raw_offset <= event["end"]:
                    ns_body_start = event["start"] - cumulative_delta
                    local_offset = raw_offset - event["start"]

                    if event["qp_map"] is not None:
                        cs = event["content_start"]
                        ce = event["content_end"]
                        if local_offset < cs:
                            decoded_local = 0
                        elif local_offset >= ce:
                            decoded_local = event["decoded_stripped_len"]
                        else:
                            qp_local = min(
                                local_offset - cs,
                                len(event["qp_map"]) - 1,
                            )
                            decoded_local = min(
                                event["qp_map"][qp_local],
                                event["decoded_stripped_len"],
                            )
                    else:
                        # Base64: proportional mapping
                        body_len = event["end"] - event["start"]
                        ratio = local_offset / max(1, body_len)
                        decoded_local = min(
                            int(ratio * event["decoded_stripped_len"]),
                            event["decoded_stripped_len"],
                        )

                    return ns_body_start + decoded_local

                body_delta = (
                    (event["end"] - event["start"])
                    - event["decoded_stripped_len"]
                )
                cumulative_delta += body_delta

        return raw_offset - cumulative_delta

    return norm_stripped, map_fn


# ---------------------------------------------------------------------------
# Re-encoding: inverse of normalization
# ---------------------------------------------------------------------------


def _encode_payload(text: str, cte: str, charset: str) -> str | None:
    """Encode decoded text back to base64 or quoted-printable. Inverse of _decode_payload."""
    try:
        if cte == "base64":
            text_bytes = text.encode(charset, errors="replace")
            encoded = base64.encodebytes(text_bytes).decode("ascii")
            return encoded
        elif cte == "quoted-printable":
            # QP encoder expects \n line endings
            normalized = text.replace("\r\n", "\n")
            text_bytes = normalized.encode(charset, errors="replace")
            encoded = quopri.encodestring(text_bytes).decode("ascii")
            # Restore \r\n line endings (QP standard uses CRLF)
            if "\r\n" not in encoded:
                encoded = encoded.replace("\n", "\r\n")
            return encoded
        return None
    except Exception:
        return None


def _restore_cte_header(header_text: str, original_cte: str) -> str:
    """Replace Content-Transfer-Encoding: 8bit back to the original value."""
    pattern = re.compile(
        r"(Content-Transfer-Encoding:\s*)8bit",
        re.IGNORECASE,
    )
    return pattern.sub(r"\g<1>" + original_cte, header_text)


def re_encode_eml(deidentified_content: str, original_raw: str) -> str:
    """
    Re-encode text/* parts back to their original Content-Transfer-Encoding.

    Mirrors normalize_eml structure but in reverse: reads the original message
    to discover which parts had base64/QP encoding, finds the corresponding
    decoded parts in deidentified_content, and re-encodes them.
    """
    msg = email.message_from_string(original_raw)

    if not msg.is_multipart():
        return _re_encode_single_part(deidentified_content, msg)

    return _re_encode_multipart(deidentified_content, msg)


def _re_encode_single_part(
    deidentified_content: str, original_msg: email.message.Message
) -> str:
    """Re-encode a non-multipart message."""
    content_type = original_msg.get_content_type() or ""
    if not content_type.startswith("text/"):
        return deidentified_content

    cte = _get_cte(original_msg)
    if cte not in ("base64", "quoted-printable"):
        return deidentified_content

    charset = original_msg.get_content_charset() or "utf-8"

    # Find the body after the first blank line
    sep_match = re.search(r"\r?\n\r?\n", deidentified_content)
    if not sep_match:
        return deidentified_content

    body_start = sep_match.end()
    decoded_body = deidentified_content[body_start:]

    encoded_text = _encode_payload(decoded_body, cte, charset)
    if encoded_text is None:
        return deidentified_content

    # Restore CTE header and body
    headers = _restore_cte_header(deidentified_content[:body_start], cte)
    return headers + encoded_text


def _re_encode_multipart(
    deidentified_content: str, original_msg: email.message.Message
) -> str:
    """Re-encode multipart message parts back to original CTE."""
    replacements: list[dict] = []
    _collect_re_encode_replacements(deidentified_content, original_msg, replacements)

    if not replacements:
        return deidentified_content

    # Apply from end to start to preserve earlier offsets
    replacements.sort(key=lambda r: r["body_start"], reverse=True)
    result = deidentified_content
    for rep in replacements:
        # Replace body
        result = result[: rep["body_start"]] + rep["encoded_text"] + result[rep["body_end"]:]
        # Replace CTE header (comes before body, offset still valid)
        result = (
            result[: rep["cte_start"]]
            + rep["cte_replacement"]
            + result[rep["cte_end"]:]
        )

    return result


def _collect_re_encode_replacements(
    deidentified_content: str,
    original_msg: email.message.Message,
    replacements: list[dict],
) -> None:
    """Recursively collect re-encoding replacements for decoded text/* parts."""
    if original_msg.is_multipart():
        for part in original_msg.get_payload():
            _collect_re_encode_replacements(deidentified_content, part, replacements)
        return

    content_type = original_msg.get_content_type() or ""
    if not content_type.startswith("text/"):
        return

    cte = _get_cte(original_msg)
    if cte not in ("base64", "quoted-printable"):
        return

    charset = original_msg.get_content_charset() or "utf-8"

    # In the deidentified content, this part now has CTE: 8bit.
    # Find the part by matching its Content-Type header value.
    ct_value = original_msg.get("Content-Type", "")
    if not ct_value:
        return

    # Search for this Content-Type in the deidentified content
    ct_escaped = re.escape(ct_value.strip())
    ct_pattern = re.compile(r"Content-Type:\s*" + ct_escaped, re.IGNORECASE)
    ct_match = ct_pattern.search(deidentified_content)
    if not ct_match:
        # Try matching just the mime type + charset portion
        ct_simple = re.escape(content_type)
        ct_pattern = re.compile(r"Content-Type:\s*" + ct_simple, re.IGNORECASE)
        ct_match = ct_pattern.search(deidentified_content)
        if not ct_match:
            return

    search_start = ct_match.start()

    # Find the CTE: 8bit header near this Content-Type
    cte_pattern = re.compile(
        r"Content-Transfer-Encoding:\s*8bit",
        re.IGNORECASE,
    )
    # Search in a region after the Content-Type header
    header_region_start = search_start
    header_region_end = min(search_start + 500, len(deidentified_content))
    header_region = deidentified_content[header_region_start:header_region_end]
    cte_match = cte_pattern.search(header_region)
    if not cte_match:
        return

    cte_abs_start = header_region_start + cte_match.start()
    cte_abs_end = header_region_start + cte_match.end()

    # Find body start: first blank line after the CTE header
    blank_match = re.search(r"\r?\n\r?\n", deidentified_content[cte_abs_end:])
    if not blank_match:
        return
    body_start = cte_abs_end + blank_match.end()

    # Find body end: next MIME boundary or end of content
    boundary_match = re.search(r"\r?\n--", deidentified_content[body_start:])
    if boundary_match:
        body_end = body_start + boundary_match.start()
    else:
        body_end = len(deidentified_content)

    decoded_body = deidentified_content[body_start:body_end]
    encoded_text = _encode_payload(decoded_body, cte, charset)
    if encoded_text is None:
        return

    # Check for overlapping replacements
    for existing in replacements:
        if body_start < existing["body_end"] and body_end > existing["body_start"]:
            return

    replacements.append({
        "body_start": body_start,
        "body_end": body_end,
        "encoded_text": encoded_text,
        "cte_start": cte_abs_start,
        "cte_end": cte_abs_end,
        "cte_replacement": f"Content-Transfer-Encoding: {cte}",
    })
