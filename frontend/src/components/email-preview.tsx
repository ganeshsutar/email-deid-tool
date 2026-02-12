import { useMemo, useState } from "react";
import type { EmailSection, WorkspaceAnnotation } from "@/types/models";
import { buildDeidentifiedEml, deidentifySections } from "@/lib/deidentify";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmailViewer } from "@/components/email-viewer";

interface EmailPreviewProps {
  rawContent: string;
  sections: EmailSection[];
  annotations?: WorkspaceAnnotation[];
}

export function EmailPreview({ rawContent, sections, annotations }: EmailPreviewProps) {
  const [viewMode, setViewMode] = useState<"email" | "text">("email");

  // If no annotations, show original behavior (no toggle bar)
  if (!annotations || annotations.length === 0) {
    return <OriginalEmailPreview rawContent={rawContent} />;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          De-identified Preview
        </span>
        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(v) => {
            if (v) setViewMode(v as "email" | "text");
          }}
          size="sm"
          variant="outline"
        >
          <ToggleGroupItem value="email" className="text-xs px-2 h-6">
            Email
          </ToggleGroupItem>
          <ToggleGroupItem value="text" className="text-xs px-2 h-6">
            Text
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className="flex-1 min-h-0">
        {viewMode === "email" ? (
          <DeidentifiedEmailView sections={sections} annotations={annotations} />
        ) : (
          <DeidentifiedSectionTextView sections={sections} annotations={annotations} />
        )}
      </div>
    </div>
  );
}

/** Original preview — used when no annotations are present */
function OriginalEmailPreview({ rawContent }: { rawContent: string }) {
  return (
    <ScrollArea className="h-full">
      <EmailViewer rawContent={rawContent} />
    </ScrollArea>
  );
}

/** Structured email view (From, To, Subject, Body) of de-identified content */
function DeidentifiedEmailView({
  sections,
  annotations,
}: {
  sections: EmailSection[];
  annotations: WorkspaceAnnotation[];
}) {
  const deidentifiedEml = useMemo(
    () => buildDeidentifiedEml(sections, annotations),
    [sections, annotations],
  );
  return <EmailViewer rawContent={deidentifiedEml} />;
}

/** Per-section de-identified text view with dividers */
function DeidentifiedSectionTextView({
  sections,
  annotations,
}: {
  sections: EmailSection[];
  annotations: WorkspaceAnnotation[];
}) {
  const deidentified = useMemo(
    () => deidentifySections(sections, annotations),
    [sections, annotations],
  );

  return (
    <ScrollArea className="h-full">
      {deidentified.map((section) => (
        <div key={section.index}>
          <div className="flex items-center gap-2 border-y bg-muted px-3 py-1.5 sticky top-0 z-10">
            <span className="text-xs font-medium">{section.label}</span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {section.type.replace("TEXT_", "").toLowerCase()}
            </Badge>
          </div>
          <SectionTextBlock content={section.content} />
        </div>
      ))}
    </ScrollArea>
  );
}

/** Plain text block with line numbers for a single section */
function SectionTextBlock({ content }: { content: string }) {
  const lineNumberText = useMemo(() => {
    const count = content.split("\n").length;
    return Array.from({ length: count }, (_, i) => i + 1).join("\n");
  }, [content]);

  return (
    <div className="flex">
      <pre className="select-none pr-2 text-right text-muted-foreground text-xs font-mono leading-5 pt-2 pb-2 pl-2 border-r min-w-[3rem]">
        {lineNumberText}
      </pre>
      <pre className="flex-1 overflow-x-auto whitespace-pre-wrap break-words font-mono text-sm leading-5 p-2">
        {content}
      </pre>
    </div>
  );
}
