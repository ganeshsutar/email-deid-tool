"""Tests for core.section_reassembler."""

import base64
import email

from django.test import SimpleTestCase

from core.section_extractor import extract_sections
from core.section_reassembler import (
    deidentify_and_reassemble,
    group_annotations_by_section,
)


class FakeAnnotation:
    """Minimal annotation-like object for testing."""

    def __init__(self, section_index, start_offset, end_offset, tag, class_name=""):
        self.section_index = section_index
        self.start_offset = start_offset
        self.end_offset = end_offset
        self.tag = tag
        self.class_name = class_name


class TestDeidentifyAndReassemble(SimpleTestCase):
    """Test round-trip deidentification + reassembly."""

    def test_single_part_plain_text(self):
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Subject: Hello\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Hello Bob, my email is alice@example.com\r\n"
        )
        sections = extract_sections(raw)
        anns = [FakeAnnotation(1, 27, 44, "[email_1]")]  # "alice@example.com" in body
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        # The email address in the body should be replaced
        self.assertIn("[email_1]", result)
        self.assertNotIn("alice@example.com\r\n", result.split("\r\n\r\n", 1)[-1] if "\r\n\r\n" in result else result.split("\n\n", 1)[-1])

    def test_multipart_alternative(self):
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: multipart/alternative; boundary=abc123\r\n"
            "\r\n"
            "--abc123\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Call me at 555-1234\r\n"
            "--abc123\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "\r\n"
            "<html>Call me at 555-1234</html>\r\n"
            "--abc123--\r\n"
        )
        sections = extract_sections(raw)
        # Annotate "555-1234" in both sections
        anns = [
            FakeAnnotation(1, 11, 19, "[phone_1]"),  # text/plain body
            FakeAnnotation(2, 17, 25, "[phone_1]"),  # text/html body
        ]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        self.assertIn("[phone_1]", result)
        # The result should be a valid multipart message
        msg = email.message_from_string(result)
        self.assertTrue(msg.is_multipart())

    def test_base64_re_encoding(self):
        body = "My SSN is 123-45-6789"
        encoded = base64.b64encode(body.encode("utf-8")).decode("ascii")
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "Content-Transfer-Encoding: base64\r\n"
            "\r\n"
            f"{encoded}\r\n"
        )
        sections = extract_sections(raw)
        anns = [FakeAnnotation(1, 10, 21, "[ssn_1]")]  # "123-45-6789"
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        # Result should be re-encoded in base64
        msg = email.message_from_string(result)
        cte = msg.get("Content-Transfer-Encoding", "").lower()
        self.assertEqual(cte, "base64")
        # Decode and verify replacement
        decoded = msg.get_payload(decode=True).decode("utf-8", errors="replace")
        self.assertIn("[ssn_1]", decoded)
        self.assertNotIn("123-45-6789", decoded)

    def test_no_annotations(self):
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "No PII here\r\n"
        )
        sections = extract_sections(raw)
        result = deidentify_and_reassemble(raw, sections, {})
        # Result should be a valid email
        msg = email.message_from_string(result)
        body = msg.get_payload(decode=True)
        self.assertIsNotNone(body)

    def test_header_deidentification(self):
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Subject: Hello\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        # Annotate "alice@example.com" in headers (section 0)
        header_content = sections[0].content
        start = header_content.find("alice@example.com")
        end = start + len("alice@example.com")
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        msg = email.message_from_string(result)
        self.assertIn("[email_1]", msg.get("From", ""))


    def test_cte_header_position_preserved(self):
        """CTE header should stay in its original position, not move to the end."""
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "Content-Transfer-Encoding: base64\r\n"
            "X-Custom: value\r\n"
            "\r\n"
        )
        body = "My SSN is 123-45-6789"
        encoded = base64.b64encode(body.encode("utf-8")).decode("ascii")
        raw += encoded + "\r\n"

        sections = extract_sections(raw)
        anns = [FakeAnnotation(1, 10, 21, "[ssn_1]")]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)

        # Extract header names in order from the result
        header_block = result.split("\n\n")[0]
        header_names = []
        for line in header_block.split("\n"):
            if ":" in line and not line.startswith((" ", "\t")):
                header_names.append(line.split(":", 1)[0])

        # CTE should come before X-Custom, not after it
        cte_idx = header_names.index("Content-Transfer-Encoding")
        custom_idx = header_names.index("X-Custom")
        self.assertLess(
            cte_idx,
            custom_idx,
            f"CTE header moved to wrong position. Header order: {header_names}",
        )


class TestGroupAnnotationsBySection(SimpleTestCase):
    def test_grouping(self):
        anns = [
            FakeAnnotation(0, 0, 5, "[a]"),
            FakeAnnotation(1, 0, 5, "[b]"),
            FakeAnnotation(1, 10, 15, "[c]"),
            FakeAnnotation(2, 0, 5, "[d]"),
        ]
        grouped = group_annotations_by_section(anns)
        self.assertEqual(len(grouped[0]), 1)
        self.assertEqual(len(grouped[1]), 2)
        self.assertEqual(len(grouped[2]), 1)

    def test_empty(self):
        grouped = group_annotations_by_section([])
        self.assertEqual(grouped, {})
