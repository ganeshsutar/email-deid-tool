"""
Extract annotatable sections from .eml files using Python's email library.

Replaces the buggy regex-based boundary detection in eml_normalizer.py with
correct MIME parsing, producing per-section content with \r-stripped text.
"""

import email
import email.message
import email.policy
from dataclasses import dataclass, field


@dataclass
class EmailSection:
    index: int  # 0-based
    section_type: str  # "HEADERS" | "TEXT_PLAIN" | "TEXT_HTML"
    label: str  # "Email Headers", "Text Body", "HTML Body"
    content: str  # Decoded text, \n-only line endings
    charset: str  # Original charset (for re-encoding)
    original_cte: str  # Original CTE: "base64", "quoted-printable", "7bit", "8bit"
    mime_path: list[int] = field(default_factory=list)  # Position in MIME tree


def extract_sections(raw_content: str) -> list[EmailSection]:
    """Parse .eml into annotatable sections using Python's email library.

    Returns a list of EmailSection objects:
    - Section 0: Email headers (everything before first blank line)
    - Section 1+: Decoded text/* body parts

    All section content has \\r stripped for consistent browser-compatible offsets.
    """
    sections: list[EmailSection] = []

    # Section 0: Headers
    header_content = _extract_headers(raw_content)
    sections.append(
        EmailSection(
            index=0,
            section_type="HEADERS",
            label="Email Headers",
            content=header_content,
            charset="utf-8",
            original_cte="7bit",
            mime_path=[],
        )
    )

    # Parse with email library for body parts
    msg = email.message_from_string(raw_content)
    body_sections = _extract_body_sections(msg)
    for i, section in enumerate(body_sections):
        section.index = i + 1  # 1-based for body sections
        sections.append(section)

    return sections


def _extract_headers(raw_content: str) -> str:
    """Extract everything before the first blank line and strip \\r."""
    # Find the header/body separator (first blank line)
    for sep in ("\r\n\r\n", "\n\n"):
        pos = raw_content.find(sep)
        if pos != -1:
            return raw_content[:pos].replace("\r", "")
    # No blank line found — entire content is headers
    return raw_content.replace("\r", "")


def _extract_body_sections(msg: email.message.Message) -> list[EmailSection]:
    """Walk MIME tree and extract decoded text/* parts."""
    sections: list[EmailSection] = []
    _walk_parts(msg, sections, path=[])
    return sections


def _walk_parts(
    msg: email.message.Message,
    sections: list[EmailSection],
    path: list[int],
) -> None:
    """Recursively walk MIME parts, collecting text/* leaves."""
    if msg.is_multipart():
        for i, part in enumerate(msg.get_payload()):
            _walk_parts(part, sections, path + [i])
        return

    content_type = msg.get_content_type() or ""
    if not content_type.startswith("text/"):
        return  # Skip non-text parts (images, attachments, etc.)

    charset = msg.get_content_charset() or "utf-8"
    cte = (msg.get("Content-Transfer-Encoding") or "7bit").strip().lower()

    # Decode payload
    try:
        raw_bytes = msg.get_payload(decode=True)
        if raw_bytes is None:
            return
        decoded_text = raw_bytes.decode(charset, errors="replace")
    except (LookupError, UnicodeDecodeError):
        # Unknown charset — try utf-8 fallback
        raw_bytes = msg.get_payload(decode=True)
        if raw_bytes is None:
            return
        decoded_text = raw_bytes.decode("utf-8", errors="replace")

    # Strip \r for browser-compatible offsets
    content = decoded_text.replace("\r", "")

    # Determine section type and label
    if content_type == "text/plain":
        section_type = "TEXT_PLAIN"
        label = "Text Body"
    elif content_type == "text/html":
        section_type = "TEXT_HTML"
        label = "HTML Body"
    else:
        section_type = f"TEXT_{content_type.split('/')[-1].upper()}"
        label = f"{content_type} Body"

    # If there are multiple sections of the same type, add a suffix
    existing_count = sum(1 for s in sections if s.section_type == section_type)
    if existing_count > 0:
        label = f"{label} ({existing_count + 1})"

    sections.append(
        EmailSection(
            index=0,  # Will be set by caller
            section_type=section_type,
            label=label,
            content=content,
            charset=charset,
            original_cte=cte,
            mime_path=path,
        )
    )
