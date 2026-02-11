import { useMemo, useEffect, useRef } from "react";
import { Paperclip, Download, FileImage, FileText, File } from "lucide-react";
import { parseEml } from "@/lib/eml-parser";
import type { EmailAttachment } from "@/lib/eml-parser";
import { formatFileSize } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { SanitizedHtmlRenderer } from "@/components/sanitized-html-renderer";

function getInitials(name: string): string {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 55%)`;
}

function formatDate(date: Date | null): string {
  if (!date) return "Unknown";
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAddresses(
  addrs: Array<{ name: string; email: string }>,
): string {
  return addrs
    .map((a) => (a.name ? `${a.name} <${a.email}>` : a.email))
    .join(", ");
}

function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return FileImage;
  if (contentType.startsWith("text/") || contentType.includes("pdf"))
    return FileText;
  return File;
}

function downloadAttachment(att: EmailAttachment) {
  if (!att.data) return;
  const blob = new Blob([att.data.buffer as ArrayBuffer], { type: att.contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = att.filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface EmailViewerProps {
  rawContent: string;
}

export function EmailViewer({ rawContent }: EmailViewerProps) {
  const email = useMemo(() => parseEml(rawContent), [rawContent]);
  const fromName = email.from.name || email.from.email;

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarFallback
            style={{ backgroundColor: hashColor(fromName) }}
            className="text-white text-sm font-medium"
          >
            {getInitials(fromName)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <dl className="text-sm space-y-1">
            <div className="flex gap-2">
              <dt className="font-medium text-muted-foreground w-16 shrink-0">
                From
              </dt>
              <dd className="truncate">
                {email.from.name
                  ? `${email.from.name} <${email.from.email}>`
                  : email.from.email}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-muted-foreground w-16 shrink-0">
                Date
              </dt>
              <dd>{formatDate(email.date)}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium text-muted-foreground w-16 shrink-0">
                Subject
              </dt>
              <dd className="font-medium">{email.subject || "(No Subject)"}</dd>
            </div>
            {email.replyTo && (
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground w-16 shrink-0">
                  Reply-To
                </dt>
                <dd className="truncate">{email.replyTo}</dd>
              </div>
            )}
            {email.to.length > 0 && (
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground w-16 shrink-0">
                  To
                </dt>
                <dd className="truncate">{formatAddresses(email.to)}</dd>
              </div>
            )}
            {email.cc.length > 0 && (
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground w-16 shrink-0">
                  CC
                </dt>
                <dd className="truncate">{formatAddresses(email.cc)}</dd>
              </div>
            )}
            {email.bcc.length > 0 && (
              <div className="flex gap-2">
                <dt className="font-medium text-muted-foreground w-16 shrink-0">
                  BCC
                </dt>
                <dd className="truncate">{formatAddresses(email.bcc)}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      <Separator />

      {email.htmlBody ? (
        <SanitizedHtmlRenderer
          html={email.htmlBody}
          attachments={email.attachments}
        />
      ) : (
        <div className="whitespace-pre-wrap text-sm">{email.body}</div>
      )}

      <AttachmentsList attachments={email.attachments} />
    </div>
  );
}

export function AttachmentsList({
  attachments,
}: {
  attachments: EmailAttachment[];
}) {
  const blobUrlsRef = useRef<string[]>([]);

  // Filter out pure inline images (they're rendered in the HTML body)
  const downloadableAttachments = useMemo(
    () => attachments.filter((att) => !(att.isInline && att.contentId)),
    [attachments],
  );

  // Build thumbnail blob URLs for image attachments
  const thumbnailUrls = useMemo(() => {
    // Revoke old URLs before creating new ones
    blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const urls: Record<number, string> = {};
    const newBlobUrls: string[] = [];
    downloadableAttachments.forEach((att, i) => {
      if (att.data && att.contentType.startsWith("image/")) {
        const blob = new Blob([att.data.buffer as ArrayBuffer], { type: att.contentType });
        const url = URL.createObjectURL(blob);
        urls[i] = url;
        newBlobUrls.push(url);
      }
    });
    blobUrlsRef.current = newBlobUrls;
    return urls;
  }, [downloadableAttachments]);

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  if (!downloadableAttachments || downloadableAttachments.length === 0)
    return null;

  return (
    <>
      <Separator />
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium">
          <Paperclip className="h-3.5 w-3.5" />
          <span>
            {downloadableAttachments.length} attachment
            {downloadableAttachments.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {downloadableAttachments.map((att, i) => {
            const Icon = getFileIcon(att.contentType);
            return (
              <div
                key={`${att.filename}-${i}`}
                className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs"
              >
                {thumbnailUrls[i] ? (
                  <img
                    src={thumbnailUrls[i]}
                    alt={att.filename}
                    className="h-8 w-8 rounded object-cover shrink-0"
                  />
                ) : (
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className="truncate max-w-[200px]">{att.filename}</span>
                <span className="text-muted-foreground">
                  ({formatFileSize(att.size)})
                </span>
                {att.data && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => downloadAttachment(att)}
                    title="Download"
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
