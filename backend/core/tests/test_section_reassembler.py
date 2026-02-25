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

    def _assert_parsable(self, result, expect_multipart=False):
        """Assert the result is a valid parsable .eml string.

        Checks:
        - email.message_from_string() succeeds
        - Has a From header (basic structural sanity)
        - Body is accessible
        - Optionally checks multipart structure
        """
        msg = email.message_from_string(result)
        # Should not raise — if we get here, it parsed
        self.assertIsNotNone(msg["From"], "Parsed email should have a From header")
        if expect_multipart:
            self.assertTrue(msg.is_multipart(), "Expected multipart structure")
            parts = msg.get_payload()
            self.assertIsInstance(parts, list, "Multipart payload should be a list")
            self.assertGreater(len(parts), 0, "Multipart should have at least one part")
        else:
            body = msg.get_payload(decode=True)
            self.assertIsNotNone(body, "Single-part body should be decodable")
        return msg

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
        self.assertIn("[email_1]", result)
        self.assertNotIn("alice@example.com", result)

    def test_header_continuation_line(self):
        """PII on a continuation line (indented) in a multi-line header."""
        raw = (
            "Received: from mail.example.com\r\n"
            "\tby mx.google.com\r\n"
            "\tfor <danielle@gmail.com>;\r\n"
            "\tMon, 1 Jan 2024 00:00:00 +0000\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        header_content = sections[0].content
        target = "danielle@gmail.com"
        start = header_content.find(target)
        end = start + len(target)
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        self.assertIn("[email_1]", result)
        self.assertNotIn("danielle@gmail.com", result)

    def test_header_duplicate_headers(self):
        """PII in duplicate headers (e.g. multiple Received: headers)."""
        raw = (
            "Received: from server1.com by mx.example.com for <alice@test.com>\r\n"
            "Received: from server2.com by mx.example.com for <bob@test.com>\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body\r\n"
        )
        sections = extract_sections(raw)
        header_content = sections[0].content
        # Annotate both emails
        alice_start = header_content.find("alice@test.com")
        bob_start = header_content.find("bob@test.com")
        anns = [
            FakeAnnotation(0, alice_start, alice_start + len("alice@test.com"), "[email_1]"),
            FakeAnnotation(0, bob_start, bob_start + len("bob@test.com"), "[email_2]"),
        ]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        self.assertIn("[email_1]", result)
        self.assertIn("[email_2]", result)
        self.assertNotIn("alice@test.com", result)
        self.assertNotIn("bob@test.com", result)

    def test_header_multiline_value(self):
        """PII buried in a multi-line header continuation."""
        raw = (
            "ARC-Authentication-Results: i=1; mx.google.com;\r\n"
            "       dkim=pass header.i=@example.com header.s=sel1\r\n"
            "       header.b=AbCdEfGh;\r\n"
            "       spf=pass (google.com: domain of admin@company.org)\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        header_content = sections[0].content
        target = "admin@company.org"
        start = header_content.find(target)
        end = start + len(target)
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        self.assertIn("[email_1]", result)
        self.assertNotIn("admin@company.org", result)

    def test_header_and_body_combined(self):
        """Annotations in both headers and body are replaced."""
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Subject: Meeting\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Hi Bob, reach me at alice@example.com or 555-0100.\r\n"
        )
        sections = extract_sections(raw)
        header_content = sections[0].content
        body_content = sections[1].content

        h_start = header_content.find("alice@example.com")
        b_email_start = body_content.find("alice@example.com")
        b_phone_start = body_content.find("555-0100")

        anns = [
            FakeAnnotation(0, h_start, h_start + len("alice@example.com"), "[email_1]"),
            FakeAnnotation(1, b_email_start, b_email_start + len("alice@example.com"), "[email_2]"),
            FakeAnnotation(1, b_phone_start, b_phone_start + len("555-0100"), "[phone_1]"),
        ]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        self.assertIn("[email_1]", result)
        self.assertIn("[email_2]", result)
        self.assertIn("[phone_1]", result)
        self.assertNotIn("555-0100", result)

    def test_header_lf_only_line_endings(self):
        """Headers with LF-only line endings are handled correctly."""
        raw = (
            "From: alice@example.com\n"
            "To: bob@example.com\n"
            "Content-Type: text/plain; charset=utf-8\n"
            "\n"
            "Body text\n"
        )
        sections = extract_sections(raw)
        header_content = sections[0].content
        start = header_content.find("alice@example.com")
        end = start + len("alice@example.com")
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        anns_by_section = group_annotations_by_section(anns)

        result = deidentify_and_reassemble(raw, sections, anns_by_section)
        self.assertIn("[email_1]", result)
        self.assertNotIn("alice@example.com", result)

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


    # ── New edge-case tests ──────────────────────────────────────────

    def test_multiple_annotations_in_single_multiline_header(self):
        """Two PII values in the same folded header (e.g. Received: with multiple emails)."""
        raw = (
            "Received: from server.com\r\n"
            "\tby mx.google.com\r\n"
            "\tfor <alice@test.com>\r\n"
            "\t(envelope from <bob@test.com>);\r\n"
            "\tMon, 1 Jan 2024 00:00:00 +0000\r\n"
            "From: sender@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        alice_start = hc.find("alice@test.com")
        bob_start = hc.find("bob@test.com")
        anns = [
            FakeAnnotation(0, alice_start, alice_start + len("alice@test.com"), "[email_1]"),
            FakeAnnotation(0, bob_start, bob_start + len("bob@test.com"), "[email_2]"),
        ]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[email_1]", result)
        self.assertIn("[email_2]", result)
        self.assertNotIn("alice@test.com", result)
        self.assertNotIn("bob@test.com", result)
        self._assert_parsable(result)

    def test_annotation_on_continuation_line_content(self):
        """Annotation on content within a continuation line (preserves leading whitespace)."""
        raw = (
            "Received: from server.com\r\n"
            "\tfor <alice@test.com>\r\n"
            "From: sender@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        # Select "for <alice@test.com>" without the leading tab
        target = "for <alice@test.com>"
        start = hc.find(target)
        end = start + len(target)
        anns = [FakeAnnotation(0, start, end, "[redacted_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[redacted_1]", result)
        self.assertNotIn("alice@test.com", result)
        self._assert_parsable(result)

    def test_space_indented_continuation(self):
        """Continuation line using spaces (not tabs)."""
        raw = (
            "ARC-Authentication-Results: i=1; mx.google.com;\r\n"
            "       dkim=pass header.i=@example.com header.s=sel1\r\n"
            "       spf=pass (google.com: domain of admin@company.org)\r\n"
            "From: sender@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        target = "admin@company.org"
        start = hc.find(target)
        end = start + len(target)
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[email_1]", result)
        self.assertNotIn("admin@company.org", result)
        self._assert_parsable(result)

    def test_multiple_annotations_across_three_received_headers(self):
        """PII in 3 different Received: headers, one annotation each."""
        raw = (
            "Received: from mail1.com by relay.com for <user1@test.com>; Mon, 1 Jan 2024\r\n"
            "Received: from mail2.com by relay.com for <user2@test.com>; Mon, 1 Jan 2024\r\n"
            "Received: from mail3.com by relay.com for <user3@test.com>; Mon, 1 Jan 2024\r\n"
            "From: sender@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        anns = []
        for i, addr in enumerate(["user1@test.com", "user2@test.com", "user3@test.com"], 1):
            start = hc.find(addr)
            anns.append(FakeAnnotation(0, start, start + len(addr), f"[email_{i}]"))
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        for i in range(1, 4):
            self.assertIn(f"[email_{i}]", result)
        self.assertNotIn("user1@test.com", result)
        self.assertNotIn("user2@test.com", result)
        self.assertNotIn("user3@test.com", result)
        self._assert_parsable(result)

    def test_class_name_fallback_for_header_annotation(self):
        """When tag is empty, falls back to [class_name] format."""
        raw = (
            "From: alice@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        start = hc.find("alice@example.com")
        end = start + len("alice@example.com")
        anns = [FakeAnnotation(0, start, end, "", class_name="EMAIL_ADDRESS")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[EMAIL_ADDRESS]", result)
        self.assertNotIn("alice@example.com", result)
        self._assert_parsable(result)

    def test_adjacent_annotations_no_gap(self):
        """Two annotations touching at their offset boundary."""
        raw = (
            "X-Addresses: alice@test.combob@test.com\r\n"
            "From: sender@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        alice_start = hc.find("alice@test.com")
        alice_end = alice_start + len("alice@test.com")
        bob_start = alice_end  # immediately after alice
        bob_end = bob_start + len("bob@test.com")
        anns = [
            FakeAnnotation(0, alice_start, alice_end, "[email_1]"),
            FakeAnnotation(0, bob_start, bob_end, "[email_2]"),
        ]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[email_1]", result)
        self.assertIn("[email_2]", result)
        self.assertNotIn("alice@test.com", result)
        self.assertNotIn("bob@test.com", result)
        self._assert_parsable(result)

    def test_header_only_email_no_body(self):
        """Email with headers only, no blank line separator, no body."""
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Subject: Headers only\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        start = hc.find("alice@example.com")
        end = start + len("alice@example.com")
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[email_1]", result)
        self.assertNotIn("alice@example.com", result)

    def test_multipart_with_header_annotations_preserves_structure(self):
        """Header annotation on multipart email must not corrupt boundary."""
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Content-Type: multipart/alternative; boundary=boundary123\r\n"
            "\r\n"
            "--boundary123\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Plain body\r\n"
            "--boundary123\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "\r\n"
            "<html>HTML body</html>\r\n"
            "--boundary123--\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        start = hc.find("alice@example.com")
        end = start + len("alice@example.com")
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[email_1]", result)
        self.assertNotIn("alice@example.com", result)
        # Structural integrity
        msg = self._assert_parsable(result, expect_multipart=True)
        self.assertEqual(msg.get_content_type(), "multipart/alternative")
        parts = msg.get_payload()
        self.assertEqual(len(parts), 2)
        # Body content should be untouched
        plain_body = parts[0].get_payload(decode=True).decode("utf-8")
        self.assertIn("Plain body", plain_body)
        html_body = parts[1].get_payload(decode=True).decode("utf-8")
        self.assertIn("HTML body", html_body)

    def test_quoted_display_name_in_from_header(self):
        """Annotation on email inside angle brackets, with quoted display name."""
        raw = (
            'From: "John Q. Doe" <john@example.com>\r\n'
            "To: recipient@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        start = hc.find("john@example.com")
        end = start + len("john@example.com")
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[email_1]", result)
        self.assertNotIn("john@example.com", result)
        # Display name should remain
        self.assertIn("John Q. Doe", result)
        self._assert_parsable(result)

    def test_very_long_single_line_header(self):
        """Header value near RFC 998 char limit."""
        long_value = "x" * 80 + "SENSITIVE_TOKEN_12345" + "y" * 80
        raw = (
            "From: sender@example.com\r\n"
            f"X-Google-Smtp-Source: {long_value}\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        target = "SENSITIVE_TOKEN_12345"
        start = hc.find(target)
        end = start + len(target)
        anns = [FakeAnnotation(0, start, end, "[token_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[token_1]", result)
        self.assertNotIn("SENSITIVE_TOKEN_12345", result)
        self._assert_parsable(result)

    def test_multiple_pii_types_in_headers(self):
        """Email, name, and IP address annotated across the header block."""
        raw = (
            "Received: from mail.example.com (10.0.0.42)\r\n"
            "\tby mx.google.com\r\n"
            "\tfor <alice@test.com>;\r\n"
            "\tMon, 1 Jan 2024 00:00:00 +0000\r\n"
            "From: John Smith <john@example.com>\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        ip_target = "10.0.0.42"
        email_target = "alice@test.com"
        name_target = "John Smith"
        anns = [
            FakeAnnotation(0, hc.find(ip_target), hc.find(ip_target) + len(ip_target), "[ip_1]"),
            FakeAnnotation(0, hc.find(email_target), hc.find(email_target) + len(email_target), "[email_1]"),
            FakeAnnotation(0, hc.find(name_target), hc.find(name_target) + len(name_target), "[name_1]"),
        ]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        self.assertIn("[ip_1]", result)
        self.assertIn("[email_1]", result)
        self.assertIn("[name_1]", result)
        self.assertNotIn("10.0.0.42", result)
        self.assertNotIn("alice@test.com", result)
        self.assertNotIn("John Smith", result)
        self._assert_parsable(result)

    def test_empty_annotation_list_for_header_section(self):
        """When annotations_by_section has key 0 but empty list, no splice occurs."""
        raw = (
            "From: alice@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        # Manually create {0: []} — empty list for header section
        result = deidentify_and_reassemble(raw, sections, {0: []})
        # Headers should be unchanged
        self.assertIn("alice@example.com", result)
        msg = email.message_from_string(result)
        self.assertEqual(msg["From"], "alice@example.com")

    def test_header_annotation_result_parses_correctly(self):
        """After header deidentification, key headers remain accessible via email API."""
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Subject: Important Meeting\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        start = hc.find("alice@example.com")
        end = start + len("alice@example.com")
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        msg = email.message_from_string(result)
        # From is deidentified but still parsable
        self.assertIn("[email_1]", msg["From"])
        # Other headers intact
        self.assertEqual(msg["To"], "bob@example.com")
        self.assertEqual(msg["Subject"], "Important Meeting")
        self.assertEqual(msg.get_content_type(), "text/plain")

    def test_body_content_survives_header_splice(self):
        """After header-only annotations, body payload decoded matches original exactly."""
        body_text = "This is the original body content.\nWith multiple lines.\n"
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            + body_text.replace("\n", "\r\n")
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        start = hc.find("alice@example.com")
        end = start + len("alice@example.com")
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        msg = email.message_from_string(result)
        decoded_body = msg.get_payload(decode=True).decode("utf-8")
        # Body should be completely untouched
        self.assertIn("This is the original body content.", decoded_body)
        self.assertIn("With multiple lines.", decoded_body)

    def test_content_type_not_corrupted_by_nearby_annotation(self):
        """Annotation near Content-Type header does not corrupt MIME type detection."""
        raw = (
            "From: alice@example.com\r\n"
            "X-Mailer: Evil Mailer <alice@example.com>\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Body text\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        # Annotate email in X-Mailer header (adjacent to Content-Type)
        target = "alice@example.com"
        # Find the second occurrence (in X-Mailer, not From)
        first_end = hc.find(target) + len(target)
        start = hc.find(target, first_end)
        end = start + len(target)
        anns = [FakeAnnotation(0, start, end, "[email_1]")]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))
        msg = email.message_from_string(result)
        self.assertEqual(msg.get_content_type(), "text/plain")
        self.assertIn("[email_1]", result)

    def test_round_trip_combined_header_body_multipart(self):
        """Most complex scenario: multipart with PII in headers AND both body parts."""
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Subject: PII Everywhere\r\n"
            "Content-Type: multipart/alternative; boundary=BOUND\r\n"
            "\r\n"
            "--BOUND\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Call me at 555-0100, regards Alice\r\n"
            "--BOUND\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "\r\n"
            "<html>Call me at 555-0100, regards Alice</html>\r\n"
            "--BOUND--\r\n"
        )
        sections = extract_sections(raw)
        hc = sections[0].content
        # Header annotation
        h_start = hc.find("alice@example.com")
        h_end = h_start + len("alice@example.com")
        # Body annotations (text/plain)
        plain_content = sections[1].content
        phone_start_plain = plain_content.find("555-0100")
        name_start_plain = plain_content.find("Alice")
        # Body annotations (text/html)
        html_content = sections[2].content
        phone_start_html = html_content.find("555-0100")
        name_start_html = html_content.find("Alice")

        anns = [
            FakeAnnotation(0, h_start, h_end, "[email_1]"),
            FakeAnnotation(1, phone_start_plain, phone_start_plain + len("555-0100"), "[phone_1]"),
            FakeAnnotation(1, name_start_plain, name_start_plain + len("Alice"), "[name_1]"),
            FakeAnnotation(2, phone_start_html, phone_start_html + len("555-0100"), "[phone_1]"),
            FakeAnnotation(2, name_start_html, name_start_html + len("Alice"), "[name_1]"),
        ]
        result = deidentify_and_reassemble(raw, sections, group_annotations_by_section(anns))

        # All tags present
        self.assertIn("[email_1]", result)
        self.assertIn("[phone_1]", result)
        self.assertIn("[name_1]", result)
        # All PII removed
        self.assertNotIn("alice@example.com", result)
        self.assertNotIn("555-0100", result)

        # Structural integrity
        msg = self._assert_parsable(result, expect_multipart=True)
        self.assertEqual(msg.get_content_type(), "multipart/alternative")
        parts = msg.get_payload()
        self.assertEqual(len(parts), 2)

        # Both parts are decodable with correct replacements
        plain_decoded = parts[0].get_payload(decode=True).decode("utf-8")
        self.assertIn("[phone_1]", plain_decoded)
        self.assertIn("[name_1]", plain_decoded)

        html_decoded = parts[1].get_payload(decode=True).decode("utf-8")
        self.assertIn("[phone_1]", html_decoded)
        self.assertIn("[name_1]", html_decoded)


    def test_all_annotations_replaced_none_skipped(self):
        """Every annotation produces a replacement — none are silently dropped."""
        raw = (
            "From: sender@example.com\r\n"
            "To: recipient@example.com\r\n"
            "X-Sender: Jane Doe\r\n"
            "Received: from mail.example.com (192.168.1.100)\r\n"
            "\tby mx.google.com; Mon, 1 Jan 2024 00:00:00 +0000\r\n"
            "Content-Type: multipart/alternative; boundary=XBOUND\r\n"
            "\r\n"
            "--XBOUND\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Hi, call John Smith at 555-0199 or email secret@private.com\r\n"
            "--XBOUND\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "\r\n"
            "<html>Hi, call John Smith at 555-0199 or email secret@private.com</html>\r\n"
            "--XBOUND--\r\n"
        )
        sections = extract_sections(raw)

        # 10 annotations with unique tags across 3 sections
        pii_targets = [
            # (section_idx, pii_text, tag)
            (0, "sender@example.com", "[h_email_1]"),
            (0, "recipient@example.com", "[h_email_2]"),
            (0, "Jane Doe", "[h_name_1]"),
            (0, "192.168.1.100", "[h_ip_1]"),
            (1, "555-0199", "[b_phone_1]"),
            (1, "secret@private.com", "[b_email_1]"),
            (1, "John Smith", "[b_name_1]"),
            (2, "555-0199", "[b_phone_2]"),
            (2, "secret@private.com", "[b_email_2]"),
            (2, "John Smith", "[b_name_2]"),
        ]

        # Build annotations by finding each target in its section
        anns = []
        for sec_idx, pii, tag in pii_targets:
            content = sections[sec_idx].content
            start = content.find(pii)
            self.assertNotEqual(start, -1, f"{pii!r} not found in section {sec_idx}")
            anns.append(FakeAnnotation(sec_idx, start, start + len(pii), tag))

        result = deidentify_and_reassemble(
            raw, sections, group_annotations_by_section(anns)
        )

        # 1. Every unique tag appears exactly once
        for _, _, tag in pii_targets:
            self.assertEqual(
                result.count(tag), 1, f"Tag {tag} should appear exactly once"
            )

        # 2. No original PII remains
        unique_pii = {pii for _, pii, _ in pii_targets}
        for pii in unique_pii:
            self.assertNotIn(pii, result)

        # 3. Total tag count matches annotation count
        total_tags = sum(result.count(tag) for _, _, tag in pii_targets)
        self.assertEqual(total_tags, len(pii_targets))

        # 4. Structural integrity
        self._assert_parsable(result, expect_multipart=True)


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
