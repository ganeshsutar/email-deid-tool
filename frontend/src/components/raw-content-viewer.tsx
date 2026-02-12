import { useCallback, useMemo, useRef } from "react";
import { getSelectionOffsets, splitTextAtAnnotations } from "@/lib/offset-utils";
import type { WorkspaceAnnotation } from "@/types/models";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RawContentViewerProps {
  content: string;
  annotations: WorkspaceAnnotation[];
  selectedAnnotationId?: string;
  onTextSelect?: (selection: {
    text: string;
    start: number;
    end: number;
  }) => void;
  onAnnotationClick?: (annotation: WorkspaceAnnotation) => void;
  readOnly?: boolean;
  annotationStatuses?: Map<string, string>;
}

interface LineSegment {
  text: string;
  annotation?: WorkspaceAnnotation;
  isHighlight?: boolean;
}

export function RawContentViewer({
  content,
  annotations,
  selectedAnnotationId,
  onTextSelect,
  onAnnotationClick,
  readOnly = false,
  annotationStatuses,
}: RawContentViewerProps) {
  const contentRef = useRef<HTMLPreElement>(null);

  const segments = useMemo(
    () => splitTextAtAnnotations(content, annotations),
    [content, annotations],
  );

  // Split segments at \n boundaries into per-line arrays
  const lineSegments = useMemo(() => {
    const lines: LineSegment[][] = [[]];
    for (const segment of segments) {
      const parts = segment.text.split("\n");
      for (let i = 0; i < parts.length; i++) {
        if (i > 0) lines.push([]);
        if (parts[i].length > 0) {
          lines[lines.length - 1].push({
            text: parts[i],
            annotation: segment.annotation,
            isHighlight: segment.isHighlight,
          });
        }
      }
    }
    return lines;
  }, [segments]);

  const handleMouseUp = useCallback(() => {
    if (readOnly || !onTextSelect || !contentRef.current) return;
    const sel = getSelectionOffsets(contentRef.current);
    if (sel) {
      onTextSelect(sel);
    }
  }, [readOnly, onTextSelect]);

  const getStatusIcon = useCallback(
    (annotationId: string) => {
      if (!annotationStatuses) return null;
      const s = annotationStatuses.get(annotationId);
      if (s === "OK") return <span className="text-green-600 text-xs ml-0.5" data-annotation-status="✓" aria-hidden="true" />;
      if (s === "FLAGGED") return <span className="text-yellow-600 text-xs ml-0.5" data-annotation-status="⚠" aria-hidden="true" />;
      if (s === "DELETED") return <span className="text-red-600 text-xs ml-0.5 line-through" data-annotation-status="✗" aria-hidden="true" />;
      return null;
    },
    [annotationStatuses],
  );

  const renderSegment = useCallback(
    (segment: LineSegment, idx: number) => {
      if (!segment.isHighlight || !segment.annotation) {
        return <span key={idx}>{segment.text}</span>;
      }
      const ann = segment.annotation;
      const isSelected = selectedAnnotationId === ann.id;
      return (
        <span
          key={idx}
          data-annotation-id={ann.id}
          style={{
            backgroundColor: ann.classColor + (isSelected ? "" : "66"),
            outline: isSelected
              ? `2px solid ${ann.classColor}`
              : undefined,
          }}
          className="cursor-pointer rounded-sm relative px-1 py-0.5"
          title={`${ann.classDisplayLabel}: ${ann.tag}`}
          aria-label={`${ann.classDisplayLabel}: ${ann.tag}`}
          onClick={() => onAnnotationClick?.(ann)}
        >
          {segment.text}
          <span
            className="text-[10px] uppercase leading-none rounded-full px-1.5 py-0.5 ml-1 inline-block align-middle font-semibold"
            style={{
              backgroundColor: ann.classColor + "CC",
              color: "#fff",
            }}
            data-annotation-badge={ann.tag}
            aria-hidden="true"
          />
          {getStatusIcon(ann.id)}
        </span>
      );
    },
    [selectedAnnotationId, onAnnotationClick, getStatusIcon],
  );

  return (
    <div className="flex h-full flex-col" data-testid="raw-content-viewer">
      <ScrollArea className="flex-1 min-h-0">
        <pre
          ref={contentRef}
          role="document"
          aria-label="Email raw content"
          className="email-line-viewer font-mono text-sm leading-loose py-2 pr-2"
          onMouseUp={handleMouseUp}
        >
          {lineSegments.map((lineSegs, lineIdx) => (
            <span key={lineIdx} data-line-number={lineIdx + 1} className="email-line">
              {lineSegs.map((seg, segIdx) => renderSegment(seg, segIdx))}
              {lineIdx < lineSegments.length - 1 ? "\n" : ""}
            </span>
          ))}
        </pre>
      </ScrollArea>
    </div>
  );
}
