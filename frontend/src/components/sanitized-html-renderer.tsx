import { useMemo, useEffect, useRef, useCallback } from "react";
import DOMPurify from "dompurify";
import {
  buildCidMap,
  replaceCidReferences,
} from "@/lib/eml-parser";
import type { EmailAttachment } from "@/lib/eml-parser";

interface SanitizedHtmlRendererProps {
  html: string;
  attachments?: EmailAttachment[];
}

const IFRAME_BASE_STYLES = `
body {
  margin: 0;
  padding: 0;
  font-family: Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
  color: #1a1a1a;
  word-break: break-word;
}
img { max-width: 100%; height: auto; }
table { max-width: 100%; }
a { color: #1a73e8; }
`;

export function SanitizedHtmlRenderer({
  html,
  attachments = [],
}: SanitizedHtmlRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const cidMapRef = useRef<{ cleanup: () => void } | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const { sanitizedHtml, cidMap } = useMemo(() => {
    const map = buildCidMap(attachments);
    const withCids = replaceCidReferences(html, map.urls);
    const clean = DOMPurify.sanitize(withCids, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ["style"],
      ALLOWED_URI_REGEXP: /^(?:blob:|data:|https?:|mailto:)/i,
    });
    return { sanitizedHtml: clean, cidMap: map };
  }, [html, attachments]);

  const srcdoc = useMemo(() => {
    if (!sanitizedHtml || !sanitizedHtml.trim()) return null;
    return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${IFRAME_BASE_STYLES}</style></head><body>${sanitizedHtml}</body></html>`;
  }, [sanitizedHtml]);

  const syncHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (!iframe?.contentDocument?.body) return;
    const height = iframe.contentDocument.body.scrollHeight;
    iframe.style.height = `${height}px`;
  }, []);

  useEffect(() => {
    cidMapRef.current?.cleanup();
    cidMapRef.current = cidMap;
    return () => {
      cidMapRef.current?.cleanup();
      cidMapRef.current = null;
    };
  }, [cidMap]);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !srcdoc) return;

    const handleLoad = () => {
      const body = iframe.contentDocument?.body;
      if (!body) return;

      // Initial height sync
      syncHeight();

      // Observe body for size changes (e.g. lazy content)
      resizeObserverRef.current?.disconnect();
      const observer = new ResizeObserver(syncHeight);
      observer.observe(body);
      resizeObserverRef.current = observer;

      // Listen for image loads to re-sync height
      const images = body.querySelectorAll("img");
      images.forEach((img) => {
        if (!img.complete) {
          img.addEventListener("load", syncHeight, { once: true });
          img.addEventListener("error", syncHeight, { once: true });
        }
      });
    };

    iframe.addEventListener("load", handleLoad);
    return () => {
      iframe.removeEventListener("load", handleLoad);
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = null;
    };
  }, [srcdoc, syncHeight]);

  if (!srcdoc) return null;

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      sandbox="allow-same-origin"
      title="Email content"
      style={{
        width: "100%",
        border: "none",
        overflow: "hidden",
        display: "block",
        minHeight: "100px",
      }}
    />
  );
}
