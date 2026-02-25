"""
Apply per-section de-identification and reassemble into valid .eml output.

Uses Python's email library for correct MIME handling instead of the
regex-based approach in eml_normalizer.py.
"""

import email
import email.message
import email.encoders
from collections import defaultdict

from .section_extractor import EmailSection


def deidentify_and_reassemble(
    raw_content: str,
    sections: list[EmailSection],
    annotations_by_section: dict[int, list],
) -> str:
    """Apply per-section deidentification and produce valid .eml output.

    Args:
        raw_content: Original .eml content
        sections: Parsed sections from extract_sections()
        annotations_by_section: Dict mapping section_index -> list of annotations
            Each annotation needs .start_offset, .end_offset, .tag, .class_name

    Returns:
        Valid .eml string with PII replaced by [TAG] placeholders
    """
    # --- Header deidentification via direct string splice ---
    # Find header/body boundary in raw content
    uses_crlf = "\r\n" in raw_content
    for sep in ("\r\n\r\n", "\n\n"):
        boundary_pos = raw_content.find(sep)
        if boundary_pos != -1:
            header_end = boundary_pos
            body_start = boundary_pos + len(sep)
            break
    else:
        # No blank line — entire content is headers
        header_end = len(raw_content)
        body_start = len(raw_content)

    header_section = next((s for s in sections if s.section_type == "HEADERS"), None)
    header_anns = annotations_by_section.get(0, [])

    if header_section and header_anns:
        deidentified_headers = _apply_replacements(header_section.content, header_anns)
        # Convert back to original line ending style
        if uses_crlf:
            deidentified_headers = deidentified_headers.replace("\n", "\r\n")
        # Splice deidentified headers into raw content
        modified_raw = deidentified_headers + raw_content[header_end:]
    else:
        modified_raw = raw_content

    # --- Body deidentification via email library ---
    msg = email.message_from_string(modified_raw)

    body_sections = [s for s in sections if s.section_type != "HEADERS"]
    if msg.is_multipart():
        _deidentify_multipart(msg, body_sections, annotations_by_section)
    elif body_sections:
        section = body_sections[0]
        anns = annotations_by_section.get(section.index, [])
        if anns:
            modified = _apply_replacements(section.content, anns)
            _set_part_payload(msg, modified, section)
        else:
            _set_part_payload(msg, section.content, section)

    return msg.as_string()


def _deidentify_multipart(
    msg: email.message.Message,
    body_sections: list[EmailSection],
    annotations_by_section: dict[int, list],
) -> None:
    """Apply deidentification to multipart message body parts."""
    # Build a map from mime_path to section
    section_by_path = {}
    for section in body_sections:
        path_key = tuple(section.mime_path)
        section_by_path[path_key] = section

    _walk_and_deidentify(msg, section_by_path, annotations_by_section, path=[])


def _walk_and_deidentify(
    msg: email.message.Message,
    section_by_path: dict[tuple, EmailSection],
    annotations_by_section: dict[int, list],
    path: list[int],
) -> None:
    """Recursively walk and deidentify text parts."""
    if msg.is_multipart():
        for i, part in enumerate(msg.get_payload()):
            _walk_and_deidentify(
                part, section_by_path, annotations_by_section, path + [i]
            )
        return

    content_type = msg.get_content_type() or ""
    if not content_type.startswith("text/"):
        return

    path_key = tuple(path)
    section = section_by_path.get(path_key)
    if not section:
        return

    anns = annotations_by_section.get(section.index, [])
    if anns:
        modified = _apply_replacements(section.content, anns)
    else:
        modified = section.content

    _set_part_payload(msg, modified, section)


def _set_part_payload(
    msg: email.message.Message,
    text: str,
    section: EmailSection,
) -> None:
    """Set the payload of a message part, re-encoding as needed."""
    import base64
    import quopri

    charset = section.charset or "utf-8"

    try:
        payload_bytes = text.encode(charset, errors="replace")
    except (LookupError, UnicodeEncodeError):
        payload_bytes = text.encode("utf-8", errors="replace")
        charset = "utf-8"

    # Determine the target CTE
    if section.original_cte == "base64":
        new_cte = "base64"
        encoded = base64.encodebytes(payload_bytes).decode("ascii")
        msg.set_payload(encoded)
    elif section.original_cte == "quoted-printable":
        new_cte = "quoted-printable"
        encoded = quopri.encodestring(payload_bytes).decode("ascii")
        msg.set_payload(encoded)
    else:
        new_cte = "8bit"
        msg.set_payload(payload_bytes)

    # Use replace_header() to preserve original header position
    if "Content-Transfer-Encoding" in msg:
        msg.replace_header("Content-Transfer-Encoding", new_cte)
    else:
        msg["Content-Transfer-Encoding"] = new_cte


def _apply_replacements(content: str, annotations: list) -> str:
    """Replace annotated spans with [TAG] placeholders.

    Processes from end to start to preserve earlier offsets.
    """
    sorted_anns = sorted(annotations, key=lambda a: a.start_offset, reverse=True)
    result = content
    for ann in sorted_anns:
        tag = ann.tag or f"[{ann.class_name}]"
        result = result[: ann.start_offset] + tag + result[ann.end_offset :]
    return result


def group_annotations_by_section(annotations) -> dict[int, list]:
    """Group annotations by their section_index field."""
    by_section: dict[int, list] = defaultdict(list)
    for ann in annotations:
        by_section[ann.section_index].append(ann)
    return dict(by_section)
