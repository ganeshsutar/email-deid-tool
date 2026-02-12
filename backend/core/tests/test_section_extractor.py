"""Tests for core.section_extractor."""

from django.test import SimpleTestCase

from core.section_extractor import extract_sections


class TestExtractSectionsSinglePart(SimpleTestCase):
    """Test extraction from single-part (non-multipart) emails."""

    def test_plain_text_7bit(self):
        raw = (
            "From: alice@example.com\r\n"
            "To: bob@example.com\r\n"
            "Subject: Hello\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Hello Bob,\r\n"
            "How are you?\r\n"
        )
        sections = extract_sections(raw)
        self.assertEqual(len(sections), 2)

        # Headers
        self.assertEqual(sections[0].index, 0)
        self.assertEqual(sections[0].section_type, "HEADERS")
        self.assertIn("From: alice@example.com", sections[0].content)
        self.assertNotIn("\r", sections[0].content)

        # Body
        self.assertEqual(sections[1].index, 1)
        self.assertEqual(sections[1].section_type, "TEXT_PLAIN")
        self.assertEqual(sections[1].content, "Hello Bob,\nHow are you?\n")
        self.assertNotIn("\r", sections[1].content)

    def test_plain_text_base64(self):
        import base64
        body = "Hello World! This is base64 encoded."
        encoded = base64.b64encode(body.encode("utf-8")).decode("ascii")
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "Content-Transfer-Encoding: base64\r\n"
            "\r\n"
            f"{encoded}\r\n"
        )
        sections = extract_sections(raw)
        self.assertEqual(len(sections), 2)
        self.assertEqual(sections[1].content, body)
        self.assertEqual(sections[1].original_cte, "base64")

    def test_plain_text_quoted_printable(self):
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "Content-Transfer-Encoding: quoted-printable\r\n"
            "\r\n"
            "Hello =E2=80=93 World\r\n"
        )
        sections = extract_sections(raw)
        self.assertEqual(len(sections), 2)
        self.assertIn("\u2013", sections[1].content)  # en dash
        self.assertEqual(sections[1].original_cte, "quoted-printable")

    def test_no_body(self):
        raw = "From: a@b.com\r\nSubject: Empty\r\n\r\n"
        sections = extract_sections(raw)
        # Headers only, body is empty string so might produce 1 or 2 sections
        self.assertEqual(sections[0].section_type, "HEADERS")

    def test_headers_only_no_blank_line(self):
        raw = "From: a@b.com\r\nSubject: No body"
        sections = extract_sections(raw)
        # Python's email library may still parse a body from this
        self.assertEqual(sections[0].section_type, "HEADERS")


class TestExtractSectionsMultipart(SimpleTestCase):
    """Test extraction from multipart emails."""

    def test_multipart_alternative(self):
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: multipart/alternative; boundary=abc123\r\n"
            "\r\n"
            "--abc123\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Plain text body\r\n"
            "--abc123\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "\r\n"
            "<html><body>HTML body</body></html>\r\n"
            "--abc123--\r\n"
        )
        sections = extract_sections(raw)
        self.assertEqual(len(sections), 3)

        self.assertEqual(sections[0].section_type, "HEADERS")
        self.assertEqual(sections[1].section_type, "TEXT_PLAIN")
        self.assertEqual(sections[1].label, "Text Body")
        self.assertIn("Plain text body", sections[1].content)
        self.assertEqual(sections[2].section_type, "TEXT_HTML")
        self.assertEqual(sections[2].label, "HTML Body")
        self.assertIn("HTML body", sections[2].content)

    def test_multipart_mixed_with_attachment(self):
        import base64
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: multipart/mixed; boundary=outer\r\n"
            "\r\n"
            "--outer\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Main body text\r\n"
            "--outer\r\n"
            "Content-Type: image/png\r\n"
            "Content-Transfer-Encoding: base64\r\n"
            "Content-Disposition: attachment; filename=image.png\r\n"
            "\r\n"
            f"{base64.b64encode(b'fake png data').decode()}\r\n"
            "--outer--\r\n"
        )
        sections = extract_sections(raw)
        # Should have headers + text/plain only (image is skipped)
        self.assertEqual(len(sections), 2)
        self.assertEqual(sections[1].section_type, "TEXT_PLAIN")

    def test_nested_multipart(self):
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: multipart/mixed; boundary=outer\r\n"
            "\r\n"
            "--outer\r\n"
            "Content-Type: multipart/alternative; boundary=inner\r\n"
            "\r\n"
            "--inner\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "\r\n"
            "Nested plain text\r\n"
            "--inner\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "\r\n"
            "<p>Nested HTML</p>\r\n"
            "--inner--\r\n"
            "--outer\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "Content-Disposition: attachment; filename=note.txt\r\n"
            "\r\n"
            "Attached text file\r\n"
            "--outer--\r\n"
        )
        sections = extract_sections(raw)
        # Headers + 3 text parts (nested plain, nested html, attached text)
        self.assertEqual(len(sections), 4)
        self.assertEqual(sections[1].section_type, "TEXT_PLAIN")
        self.assertEqual(sections[2].section_type, "TEXT_HTML")
        self.assertEqual(sections[3].section_type, "TEXT_PLAIN")
        self.assertEqual(sections[3].label, "Text Body (2)")

    def test_multipart_base64_body(self):
        import base64
        body = "This is base64 encoded body text with special chars: <>&"
        encoded = base64.b64encode(body.encode("utf-8")).decode("ascii")
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: multipart/alternative; boundary=bound\r\n"
            "\r\n"
            "--bound\r\n"
            "Content-Type: text/plain; charset=utf-8\r\n"
            "Content-Transfer-Encoding: base64\r\n"
            "\r\n"
            f"{encoded}\r\n"
            "--bound--\r\n"
        )
        sections = extract_sections(raw)
        self.assertEqual(sections[1].content, body)
        self.assertEqual(sections[1].original_cte, "base64")

    def test_various_charsets(self):
        import base64
        # ISO-8859-1 encoded text
        body = "Caf\xe9 au lait"
        encoded = base64.b64encode(body.encode("iso-8859-1")).decode("ascii")
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: text/plain; charset=iso-8859-1\r\n"
            "Content-Transfer-Encoding: base64\r\n"
            "\r\n"
            f"{encoded}\r\n"
        )
        sections = extract_sections(raw)
        self.assertEqual(sections[1].content, "Caf\xe9 au lait")
        self.assertEqual(sections[1].charset, "iso-8859-1")


class TestExtractSectionsEdgeCases(SimpleTestCase):
    """Test edge cases and the specific DoorDash HTML comment bug."""

    def test_html_comment_with_dashes_not_boundary(self):
        """The DoorDash email had '----></td>' which was falsely matched as a boundary."""
        raw = (
            "From: sender@test.com\r\n"
            "Content-Type: multipart/alternative; boundary=myboundary\r\n"
            "\r\n"
            "--myboundary\r\n"
            "Content-Type: text/html; charset=utf-8\r\n"
            "\r\n"
            "<html><body>\r\n"
            "<!-- This is a comment ----></td>\r\n"
            "<p>Content after comment</p>\r\n"
            "</body></html>\r\n"
            "--myboundary--\r\n"
        )
        sections = extract_sections(raw)
        html_section = next(s for s in sections if s.section_type == "TEXT_HTML")
        # The entire HTML body should be present, not truncated at the comment
        self.assertIn("Content after comment", html_section.content)
        self.assertIn("----></td>", html_section.content)

    def test_cr_stripped_from_all_sections(self):
        raw = (
            "From: a@b.com\r\n"
            "Subject: Test\r\n"
            "Content-Type: text/plain\r\n"
            "\r\n"
            "Line 1\r\n"
            "Line 2\r\n"
        )
        sections = extract_sections(raw)
        for section in sections:
            self.assertNotIn("\r", section.content, f"\\r found in {section.label}")

    def test_section_indices_sequential(self):
        raw = (
            "From: s@t.com\r\n"
            "Content-Type: multipart/alternative; boundary=b\r\n"
            "\r\n"
            "--b\r\n"
            "Content-Type: text/plain\r\n"
            "\r\n"
            "Plain\r\n"
            "--b\r\n"
            "Content-Type: text/html\r\n"
            "\r\n"
            "<p>HTML</p>\r\n"
            "--b--\r\n"
        )
        sections = extract_sections(raw)
        for i, section in enumerate(sections):
            self.assertEqual(section.index, i)

    def test_mime_path_tracking(self):
        raw = (
            "From: s@t.com\r\n"
            "Content-Type: multipart/mixed; boundary=outer\r\n"
            "\r\n"
            "--outer\r\n"
            "Content-Type: multipart/alternative; boundary=inner\r\n"
            "\r\n"
            "--inner\r\n"
            "Content-Type: text/plain\r\n"
            "\r\n"
            "Plain\r\n"
            "--inner\r\n"
            "Content-Type: text/html\r\n"
            "\r\n"
            "<p>HTML</p>\r\n"
            "--inner--\r\n"
            "--outer--\r\n"
        )
        sections = extract_sections(raw)
        # Skip headers (index 0)
        plain = sections[1]
        html = sections[2]
        self.assertEqual(plain.mime_path, [0, 0])
        self.assertEqual(html.mime_path, [0, 1])
