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
    msg = email.message_from_string(raw_content)

    # Apply header deidentification (section 0)
    header_section = next((s for s in sections if s.section_type == "HEADERS"), None)
    header_anns = annotations_by_section.get(0, [])
    if header_section and header_anns:
        _deidentify_headers(msg, header_section, header_anns)

    # Apply body deidentification
    body_sections = [s for s in sections if s.section_type != "HEADERS"]
    if msg.is_multipart():
        _deidentify_multipart(msg, body_sections, annotations_by_section)
    elif body_sections:
        # Single-part message
        section = body_sections[0]
        anns = annotations_by_section.get(section.index, [])
        if anns:
            modified = _apply_replacements(section.content, anns)
            _set_part_payload(msg, modified, section)
        else:
            # Even if no annotations, set decoded payload so CTE stays consistent
            _set_part_payload(msg, section.content, section)

    return msg.as_string()


def _deidentify_headers(
    msg: email.message.Message,
    header_section: EmailSection,
    annotations: list,
) -> None:
    """Apply deidentification to email headers.

    Modifies header values in the message object by applying annotation
    replacements to the header text.
    """
    # Build the deidentified header text
    deidentified = _apply_replacements(header_section.content, annotations)

    # Parse deidentified header text to extract individual header values
    # We need to map changes back to the original message headers
    deidentified_lines = deidentified.split("\n")
    original_lines = header_section.content.split("\n")

    if len(deidentified_lines) != len(original_lines):
        # Line counts differ — fall back to simple header replacement
        _replace_headers_by_parsing(msg, deidentified)
        return

    # Find changed lines and update corresponding headers
    for i, (orig, new) in enumerate(zip(original_lines, deidentified_lines)):
        if orig != new:
            # Parse which header this line belongs to
            if ":" in new and not new.startswith((" ", "\t")):
                header_name = new.split(":", 1)[0]
                header_value = new.split(":", 1)[1].strip()
                try:
                    msg.replace_header(header_name, header_value)
                except KeyError:
                    msg[header_name] = header_value


def _replace_headers_by_parsing(
    msg: email.message.Message,
    deidentified_header_text: str,
) -> None:
    """Replace headers by parsing the deidentified header text."""
    current_header = None
    current_value_parts: list[str] = []
    headers_to_set: list[tuple[str, str]] = []

    for line in deidentified_header_text.split("\n"):
        if line.startswith((" ", "\t")):
            # Continuation line
            current_value_parts.append(line)
        elif ":" in line:
            # New header
            if current_header:
                headers_to_set.append(
                    (current_header, "\n".join(current_value_parts))
                )
            current_header = line.split(":", 1)[0]
            current_value_parts = [line.split(":", 1)[1].strip()]
        elif current_header:
            current_value_parts.append(line)

    if current_header:
        headers_to_set.append(
            (current_header, "\n".join(current_value_parts))
        )

    for header_name, header_value in headers_to_set:
        if header_name.lower() in ("content-type", "mime-version", "content-transfer-encoding"):
            continue  # Don't modify structural headers
        if header_name in msg:
            original = msg[header_name]
            if original != header_value:
                try:
                    msg.replace_header(header_name, header_value)
                except KeyError:
                    msg[header_name] = header_value


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
