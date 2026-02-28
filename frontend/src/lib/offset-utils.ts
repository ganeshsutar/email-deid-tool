import type { WorkspaceAnnotation } from "@/types/models";

export interface TextSegment {
  text: string;
  annotation?: WorkspaceAnnotation;
  isHighlight: boolean;
}

/** Count Unicode code points (not UTF-16 code units). */
function codePointLength(str: string): number {
  return Array.from(str).length;
}

export function getSelectionOffsets(
  container: HTMLElement,
): { text: string; start: number; end: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const text = selection.toString();
  if (!text.trim()) return null;

  // Check that the selection is within our container
  if (!container.contains(range.startContainer) || !container.contains(range.endContainer)) {
    return null;
  }

  // Create a range from container start to selection start
  const preSelectionRange = document.createRange();
  preSelectionRange.selectNodeContents(container);
  preSelectionRange.setEnd(range.startContainer, range.startOffset);

  const start = codePointLength(preSelectionRange.toString());
  const end = start + codePointLength(text);

  return { text, start, end };
}

export function splitTextAtAnnotations(
  text: string,
  annotations: WorkspaceAnnotation[],
): TextSegment[] {
  if (annotations.length === 0) {
    return [{ text, isHighlight: false }];
  }

  // Sort by startOffset, then by endOffset (longer first)
  const sorted = [...annotations].sort((a, b) => {
    if (a.startOffset !== b.startOffset) return a.startOffset - b.startOffset;
    return b.endOffset - a.endOffset;
  });

  // Remove overlaps: keep the first-starting annotation
  const nonOverlapping: WorkspaceAnnotation[] = [];
  let lastEnd = -1;
  for (const ann of sorted) {
    if (ann.startOffset >= lastEnd) {
      nonOverlapping.push(ann);
      lastEnd = ann.endOffset;
    }
  }

  // Convert to code-point array once for accurate slicing
  const codePoints = Array.from(text);
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const ann of nonOverlapping) {
    const start = Math.max(ann.startOffset, 0);
    const end = Math.min(ann.endOffset, codePoints.length);

    if (start > cursor) {
      segments.push({
        text: codePoints.slice(cursor, start).join(""),
        isHighlight: false,
      });
    }

    if (start < end) {
      segments.push({
        text: codePoints.slice(start, end).join(""),
        annotation: ann,
        isHighlight: true,
      });
    }

    cursor = end;
  }

  if (cursor < codePoints.length) {
    segments.push({
      text: codePoints.slice(cursor).join(""),
      isHighlight: false,
    });
  }

  return segments;
}

export function scrollToAnnotation(
  container: HTMLElement,
  annotationId: string,
): void {
  const span = container.querySelector(`[data-annotation-id="${annotationId}"]`);
  if (span) {
    span.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}
