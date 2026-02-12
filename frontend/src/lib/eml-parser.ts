export interface ParsedEmailAddress {
  name: string;
  email: string;
}

export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number; // actual decoded bytes (or estimate if skipped)
  data: Uint8Array | null;
  contentId: string | null;
  isInline: boolean;
}

export interface ParsedEmail {
  from: ParsedEmailAddress;
  to: ParsedEmailAddress[];
  cc: ParsedEmailAddress[];
  bcc: ParsedEmailAddress[];
  subject: string;
  date: Date | null;
  replyTo: string | null;
  body: string;
  htmlBody: string | null;
  isHtml: boolean;
  attachments: EmailAttachment[];
}

// ---------------------------------------------------------------------------
// CID map types (exported for use in components)
// ---------------------------------------------------------------------------
export interface CidMap {
  urls: Map<string, string>;
  cleanup: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const MAX_ATTACHMENT_DECODE_SIZE = 25 * 1024 * 1024; // 25 MB

// ---------------------------------------------------------------------------
// Binary decoding helpers
// ---------------------------------------------------------------------------
function decodeBase64ToBytes(base64: string): Uint8Array {
  const cleaned = base64.replace(/\s/g, "");
  const binaryStr = atob(cleaned);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i);
  }
  return bytes;
}

function decodeQuotedPrintableToBytes(text: string): Uint8Array {
  const unfolded = text.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < unfolded.length; i++) {
    if (unfolded[i] === "=" && i + 2 < unfolded.length) {
      const hex = unfolded.substring(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    bytes.push(unfolded.charCodeAt(i));
  }
  return new Uint8Array(bytes);
}

function decodeBinaryPart(part: MimePart): Uint8Array | null {
  const enc = (part.headers["content-transfer-encoding"] || "").toLowerCase();
  const estimatedSize = estimateDecodedSize(part.body, enc);
  if (estimatedSize > MAX_ATTACHMENT_DECODE_SIZE) return null;

  try {
    if (enc === "base64") return decodeBase64ToBytes(part.body);
    if (enc === "quoted-printable") return decodeQuotedPrintableToBytes(part.body);
    // 7bit / 8bit / binary — treat as raw bytes
    const bytes = new Uint8Array(part.body.length);
    for (let i = 0; i < part.body.length; i++) {
      bytes[i] = part.body.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Charset-aware text decoding
// ---------------------------------------------------------------------------
function extractCharset(contentType: string): string {
  const match = contentType.match(/charset="?([^";\s]+)"?/i);
  return match ? match[1].toLowerCase().trim() : "utf-8";
}

/** Normalize charset aliases to names TextDecoder understands */
function normalizeCharset(charset: string): string {
  const c = charset.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const aliases: Record<string, string> = {
    "utf8": "utf-8",
    "latin1": "iso-8859-1",
    "latin-1": "iso-8859-1",
    "cp1252": "windows-1252",
    "ascii": "utf-8",
    "usascii": "utf-8",
    "us-ascii": "utf-8",
  };
  return aliases[c] || charset;
}

function decodeWithCharset(bytes: Uint8Array, charset: string): string {
  const normalized = normalizeCharset(charset);
  try {
    return new TextDecoder(normalized).decode(bytes);
  } catch {
    // Fallback to utf-8 if charset is unknown
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  }
}

function decodeBodyWithCharset(
  body: string,
  transferEncoding: string,
  charset: string,
): string {
  const enc = transferEncoding.toLowerCase();
  if (enc === "base64") {
    const bytes = decodeBase64ToBytes(body);
    return decodeWithCharset(bytes, charset);
  }
  if (enc === "quoted-printable") {
    const bytes = decodeQuotedPrintableToBytes(body);
    return decodeWithCharset(bytes, charset);
  }
  // 7bit/8bit — if charset is utf-8 just return as-is, otherwise decode
  if (charset === "utf-8" || charset === "us-ascii" || charset === "ascii") {
    return body;
  }
  const bytes = new Uint8Array(body.length);
  for (let i = 0; i < body.length; i++) {
    bytes[i] = body.charCodeAt(i);
  }
  return decodeWithCharset(bytes, charset);
}

// ---------------------------------------------------------------------------
// CID helpers
// ---------------------------------------------------------------------------
function extractContentId(headers: Record<string, string>): string | null {
  const cid = headers["content-id"];
  if (!cid) return null;
  // Strip angle brackets: <xxx> → xxx
  return cid.replace(/^<|>$/g, "").trim() || null;
}

function isInlineDisposition(headers: Record<string, string>): boolean {
  const disposition = (headers["content-disposition"] || "").toLowerCase();
  return disposition.startsWith("inline");
}

// ---------------------------------------------------------------------------
// CID map builder + resolver (exported)
// ---------------------------------------------------------------------------
export function buildCidMap(attachments: EmailAttachment[]): CidMap {
  const urls = new Map<string, string>();
  for (const att of attachments) {
    if (att.contentId && att.data) {
      const blob = new Blob([att.data.buffer as ArrayBuffer], { type: att.contentType });
      const url = URL.createObjectURL(blob);
      urls.set(att.contentId, url);
    }
  }
  return {
    urls,
    cleanup: () => {
      for (const url of urls.values()) {
        URL.revokeObjectURL(url);
      }
    },
  };
}

export function replaceCidReferences(
  html: string,
  cidUrls: Map<string, string>,
): string {
  if (cidUrls.size === 0) return html;
  return html.replace(/cid:([^\s"'<>]+)/gi, (_match, cid) => {
    return cidUrls.get(cid) || `cid:${cid}`;
  });
}

// ---------------------------------------------------------------------------
// RFC 2047 decoding (charset-aware)
// ---------------------------------------------------------------------------
function decodeRFC2047(value: string): string {
  return value.replace(
    /=\?([^?]+)\?([BQbq])\?([^?]+)\?=/g,
    (_match, charset: string, encoding: string, encoded: string) => {
      if (encoding.toUpperCase() === "B") {
        try {
          const bytes = decodeBase64ToBytes(encoded);
          return decodeWithCharset(bytes, charset);
        } catch {
          return encoded;
        }
      }
      // Quoted-printable
      const qpText = encoded.replace(/_/g, " ");
      const bytes = decodeQuotedPrintableToBytes(qpText);
      return decodeWithCharset(bytes, charset);
    },
  );
}

// ---------------------------------------------------------------------------
// Address parsing
// ---------------------------------------------------------------------------
function parseAddresses(value: string): ParsedEmailAddress[] {
  if (!value.trim()) return [];

  const results: ParsedEmailAddress[] = [];
  // Split on commas not inside angle brackets or quotes
  const parts = value.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);

  for (const part of parts) {
    const trimmed = decodeRFC2047(part.trim());
    // Match "Name" <email> or Name <email>
    const namedMatch = trimmed.match(
      /^"?([^"<]*?)"?\s*<([^>]+)>/,
    );
    if (namedMatch) {
      results.push({
        name: namedMatch[1].trim(),
        email: namedMatch[2].trim(),
      });
    } else {
      // Plain email
      const emailOnly = trimmed.replace(/[<>]/g, "").trim();
      if (emailOnly) {
        results.push({ name: "", email: emailOnly });
      }
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Legacy decoding helpers (kept exported for backward compat)
// ---------------------------------------------------------------------------
export function decodeQuotedPrintable(text: string): string {
  const unfolded = text.replace(/=\r?\n/g, "");
  return unfolded.replace(/=([0-9A-Fa-f]{2})/g, (_match, hex) =>
    String.fromCharCode(parseInt(hex, 16)),
  );
}

export function decodeBase64(text: string): string {
  try {
    return atob(text.replace(/\s/g, ""));
  } catch {
    return text;
  }
}

// ---------------------------------------------------------------------------
// HTML stripping
// ---------------------------------------------------------------------------
function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

// ---------------------------------------------------------------------------
// MIME parsing
// ---------------------------------------------------------------------------
export interface MimePart {
  headers: Record<string, string>;
  body: string;
}

export function parseMultipart(body: string, boundary: string): MimePart[] {
  const parts: MimePart[] = [];
  const delimiter = `--${boundary}`;
  const endDelimiter = `--${boundary}--`;
  const sections = body.split(delimiter);

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed || trimmed.startsWith("--") || trimmed === endDelimiter.slice(delimiter.length)) {
      continue;
    }
    // Remove trailing end delimiter
    const cleaned = trimmed.replace(/--\s*$/, "").trim();

    // Split headers/body
    const splitIndex = cleaned.search(/\r?\n\r?\n/);
    if (splitIndex === -1) continue;

    const headerStr = cleaned.substring(0, splitIndex);
    const partBody = cleaned.substring(splitIndex).replace(/^\r?\n\r?\n/, "");

    const headers: Record<string, string> = {};
    // Unfold headers
    const unfoldedHeaders = headerStr.replace(/\r?\n[ \t]+/g, " ");
    for (const line of unfoldedHeaders.split(/\r?\n/)) {
      const colonIdx = line.indexOf(":");
      if (colonIdx > 0) {
        const key = line.substring(0, colonIdx).trim().toLowerCase();
        headers[key] = line.substring(colonIdx + 1).trim();
      }
    }

    parts.push({ headers, body: partBody });
  }
  return parts;
}

// ---------------------------------------------------------------------------
// Attachment / part helpers
// ---------------------------------------------------------------------------
function extractFilename(headers: Record<string, string>): string {
  const disposition = headers["content-disposition"] || "";
  const dispMatch = disposition.match(/filename="?([^";\n]+)"?/i);
  if (dispMatch) return decodeRFC2047(dispMatch[1].trim());

  const ct = headers["content-type"] || "";
  const ctMatch = ct.match(/name="?([^";\n]+)"?/i);
  if (ctMatch) return decodeRFC2047(ctMatch[1].trim());

  return "unnamed";
}

function estimateDecodedSize(body: string, transferEncoding: string): number {
  const enc = (transferEncoding || "").toLowerCase();
  if (enc === "base64") {
    const stripped = body.replace(/\s/g, "");
    return Math.floor(stripped.length * 0.75);
  }
  return body.length;
}

function isAttachmentDisposition(headers: Record<string, string>): boolean {
  const disposition = (headers["content-disposition"] || "").toLowerCase();
  return disposition.startsWith("attachment");
}

interface FindPartsResult {
  textPart: MimePart | null;
  htmlPart: MimePart | null;
  attachments: EmailAttachment[];
}

function findParts(parts: MimePart[]): FindPartsResult {
  let textPart: MimePart | null = null;
  let htmlPart: MimePart | null = null;
  const attachments: EmailAttachment[] = [];

  for (const part of parts) {
    const ct = (part.headers["content-type"] || "").toLowerCase();
    if (ct.includes("multipart/")) {
      // Recurse into nested multipart
      const originalCt = part.headers["content-type"] || "";
      const nestedBoundary = originalCt.match(/boundary="?([^";\s]+)"?/i);
      if (nestedBoundary) {
        const nestedParts = parseMultipart(part.body, nestedBoundary[1]);
        const found = findParts(nestedParts);
        if (!textPart && found.textPart) textPart = found.textPart;
        if (!htmlPart && found.htmlPart) htmlPart = found.htmlPart;
        attachments.push(...found.attachments);
      }
    } else if ((ct.includes("text/plain") || ct.includes("text/html")) && isAttachmentDisposition(part.headers)) {
      // Text parts explicitly marked as attachments
      const data = decodeBinaryPart(part);
      attachments.push({
        filename: extractFilename(part.headers),
        contentType: ct.split(";")[0].trim(),
        size: data ? data.length : estimateDecodedSize(part.body, part.headers["content-transfer-encoding"] || ""),
        data,
        contentId: extractContentId(part.headers),
        isInline: isInlineDisposition(part.headers),
      });
    } else if (ct.includes("text/plain") && !textPart) {
      textPart = part;
    } else if (ct.includes("text/html") && !htmlPart) {
      htmlPart = part;
    } else if (!ct.includes("text/")) {
      // Non-text, non-multipart parts are attachments
      const data = decodeBinaryPart(part);
      attachments.push({
        filename: extractFilename(part.headers),
        contentType: ct.split(";")[0].trim() || "application/octet-stream",
        size: data ? data.length : estimateDecodedSize(part.body, part.headers["content-transfer-encoding"] || ""),
        data,
        contentId: extractContentId(part.headers),
        isInline: isInlineDisposition(part.headers),
      });
    }
  }

  return { textPart, htmlPart, attachments };
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------
export function parseEml(rawContent: string): ParsedEmail {
  const result: ParsedEmail = {
    from: { name: "", email: "" },
    to: [],
    cc: [],
    bcc: [],
    subject: "",
    date: null,
    replyTo: null,
    body: "",
    htmlBody: null,
    isHtml: false,
    attachments: [],
  };

  // Split headers and body at first blank line
  const splitMatch = rawContent.match(/^([\s\S]*?)\r?\n\r?\n([\s\S]*)$/);
  if (!splitMatch) {
    result.body = rawContent;
    return result;
  }

  const headerSection = splitMatch[1];
  const bodySection = splitMatch[2];

  // Unfold multi-line headers
  const unfoldedHeaders = headerSection.replace(/\r?\n[ \t]+/g, " ");
  const headers: Record<string, string> = {};
  for (const line of unfoldedHeaders.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.substring(0, colonIdx).trim().toLowerCase();
      headers[key] = line.substring(colonIdx + 1).trim();
    }
  }

  // Parse header fields
  if (headers["from"]) {
    const addrs = parseAddresses(headers["from"]);
    if (addrs.length > 0) result.from = addrs[0];
  }
  if (headers["to"]) result.to = parseAddresses(headers["to"]);
  if (headers["cc"]) result.cc = parseAddresses(headers["cc"]);
  if (headers["bcc"]) result.bcc = parseAddresses(headers["bcc"]);
  if (headers["subject"]) result.subject = decodeRFC2047(headers["subject"]);
  if (headers["date"]) {
    try {
      result.date = new Date(headers["date"]);
      if (isNaN(result.date.getTime())) result.date = null;
    } catch {
      result.date = null;
    }
  }
  if (headers["reply-to"]) result.replyTo = decodeRFC2047(headers["reply-to"]);

  const contentType = headers["content-type"] || "text/plain";
  const transferEncoding = headers["content-transfer-encoding"] || "7bit";

  // Check for multipart
  const boundaryMatch = contentType.match(/boundary="?([^";\s]+)"?/i);
  if (boundaryMatch) {
    const boundary = boundaryMatch[1];
    const parts = parseMultipart(bodySection, boundary);

    // Recursively find text/plain, text/html parts, and attachments
    const { textPart, htmlPart, attachments } = findParts(parts);
    result.attachments = attachments;

    if (textPart) {
      const enc = textPart.headers["content-transfer-encoding"] || "7bit";
      const charset = extractCharset(textPart.headers["content-type"] || "");
      result.body = decodeBodyWithCharset(textPart.body, enc, charset);
      result.isHtml = false;
    }

    if (htmlPart) {
      const enc = htmlPart.headers["content-transfer-encoding"] || "7bit";
      const charset = extractCharset(htmlPart.headers["content-type"] || "");
      const decodedHtml = decodeBodyWithCharset(htmlPart.body, enc, charset);
      result.htmlBody = decodedHtml;

      if (!textPart) {
        // HTML-only multipart — derive plain text for body
        result.body = stripHtmlTags(decodedHtml);
        result.isHtml = true;
      }
    }
  } else {
    // Single-part message
    const charset = extractCharset(contentType);
    const decoded = decodeBodyWithCharset(bodySection, transferEncoding, charset);
    if (contentType.toLowerCase().includes("text/html")) {
      result.htmlBody = decoded;
      result.body = stripHtmlTags(decoded);
      result.isHtml = true;
    } else {
      result.body = decoded;
    }
  }

  return result;
}
