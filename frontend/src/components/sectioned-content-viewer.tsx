import { useCallback, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getSelectionOffsets, splitTextAtAnnotations } from "@/lib/offset-utils";
import type { EmailSection, WorkspaceAnnotation } from "@/types/models";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SectionedContentViewerProps {
  sections: EmailSection[];
  annotations: WorkspaceAnnotation[];
  selectedAnnotationId?: string;
  onTextSelect?: (selection: {
    text: string;
    start: number;
    end: number;
    sectionIndex: number;
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

export function SectionedContentViewer({
  sections,
  annotations,
  selectedAnnotationId,
  onTextSelect,
  onAnnotationClick,
  readOnly = false,
  annotationStatuses,
}: SectionedContentViewerProps) {
  const sectionRefs = useRef<Map<number, HTMLPreElement>>(new Map());
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(
    () => new Set([0]), // Headers collapsed by default
  );

  const annotationsBySection = useMemo(() => {
    const map = new Map<number, WorkspaceAnnotation[]>();
    for (const ann of annotations) {
      const existing = map.get(ann.sectionIndex) ?? [];
      existing.push(ann);
      map.set(ann.sectionIndex, existing);
    }
    return map;
  }, [annotations]);

  const toggleSection = useCallback((index: number) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  }, []);

  const handleMouseUp = useCallback(
    (sectionIndex: number) => {
      if (readOnly || !onTextSelect) return;
      const preEl = sectionRefs.current.get(sectionIndex);
      if (!preEl) return;
      const sel = getSelectionOffsets(preEl);
      if (sel) {
        onTextSelect({ ...sel, sectionIndex });
      }
    },
    [readOnly, onTextSelect],
  );

  const getStatusIcon = useCallback(
    (annotationId: string) => {
      if (!annotationStatuses) return null;
      const s = annotationStatuses.get(annotationId);
      if (s === "OK")
        return (
          <span
            className="text-green-600 text-xs ml-0.5"
            data-annotation-status="\u2713"
            aria-hidden="true"
          />
        );
      if (s === "FLAGGED")
        return (
          <span
            className="text-yellow-600 text-xs ml-0.5"
            data-annotation-status="\u26A0"
            aria-hidden="true"
          />
        );
      if (s === "DELETED")
        return (
          <span
            className="text-red-600 text-xs ml-0.5 line-through"
            data-annotation-status="\u2717"
            aria-hidden="true"
          />
        );
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
            outline: isSelected ? `2px solid ${ann.classColor}` : undefined,
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
    <div className="flex h-full flex-col" data-testid="sectioned-content-viewer">
      <ScrollArea className="flex-1 min-h-0">
        {sections.map((section) => {
          const sectionAnns = annotationsBySection.get(section.index) ?? [];
          const isCollapsed = collapsedSections.has(section.index);

          return (
            <SectionBlock
              key={section.index}
              section={section}
              annotations={sectionAnns}
              isCollapsed={isCollapsed}
              onToggle={() => toggleSection(section.index)}
              onMouseUp={() => handleMouseUp(section.index)}
              renderSegment={renderSegment}
              sectionRefs={sectionRefs}
              readOnly={readOnly}
            />
          );
        })}
      </ScrollArea>
    </div>
  );
}

interface SectionBlockProps {
  section: EmailSection;
  annotations: WorkspaceAnnotation[];
  isCollapsed: boolean;
  onToggle: () => void;
  onMouseUp: () => void;
  renderSegment: (segment: LineSegment, idx: number) => React.ReactNode;
  sectionRefs: React.MutableRefObject<Map<number, HTMLPreElement>>;
  readOnly: boolean;
}

function SectionBlock({
  section,
  annotations,
  isCollapsed,
  onToggle,
  onMouseUp,
  renderSegment,
  sectionRefs,
  readOnly,
}: SectionBlockProps) {
  const segments = useMemo(
    () => splitTextAtAnnotations(section.content, annotations),
    [section.content, annotations],
  );

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

  const setRef = useCallback(
    (el: HTMLPreElement | null) => {
      if (el) {
        sectionRefs.current.set(section.index, el);
      } else {
        sectionRefs.current.delete(section.index);
      }
    },
    [section.index, sectionRefs],
  );

  return (
    <Collapsible
      open={!isCollapsed}
      onOpenChange={onToggle}
      data-section-index={section.index}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="group flex w-full items-center gap-2 border-y bg-muted px-3 py-1.5 text-left sticky top-0 z-10 hover:bg-muted/80 transition-colors"
        >
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=closed]:-rotate-90" />
          <span className="text-xs font-medium">{section.label}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {section.type.replace("TEXT_", "").toLowerCase()}
          </Badge>
          {annotations.length > 0 && (
            <span className="text-[10px] text-muted-foreground ml-auto">
              {annotations.length} annotation{annotations.length !== 1 ? "s" : ""}
            </span>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <pre
          ref={setRef}
          role="document"
          aria-label={`${section.label} content`}
          className="email-line-viewer font-mono text-sm leading-loose py-2 pr-2"
          onMouseUp={readOnly ? undefined : onMouseUp}
        >
          {lineSegments.map((lineSegs, lineIdx) => (
            <span
              key={lineIdx}
              data-line-number={lineIdx + 1}
              className="email-line"
            >
              {lineSegs.map((seg, segIdx) => renderSegment(seg, segIdx))}
              {lineIdx < lineSegments.length - 1 ? "\n" : ""}
            </span>
          ))}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
}
