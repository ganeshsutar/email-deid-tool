import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmailViewer } from "@/components/email-viewer";
import { splitTextAtAnnotations } from "@/lib/offset-utils";
import { deidentifySections } from "@/lib/deidentify";
import type { EmailSection, WorkspaceAnnotation } from "@/types/models";
import type { ExportPreview as ExportPreviewData } from "../api/export-mapper";

interface ExportPreviewDialogProps {
  data: ExportPreviewData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SectionDivider({ section }: { section: EmailSection }) {
  return (
    <div className="flex items-center gap-2 border-y bg-muted px-3 py-1.5">
      <span className="text-xs font-medium">{section.label}</span>
      <span className="text-[10px] text-muted-foreground">
        {section.type.replace("TEXT_", "").toLowerCase()}
      </span>
    </div>
  );
}

function OriginalSectionContent({
  section,
  annotations,
}: {
  section: EmailSection;
  annotations: WorkspaceAnnotation[];
}) {
  const sectionAnns = annotations.filter(
    (a) => a.sectionIndex === section.index,
  );
  const segments = splitTextAtAnnotations(section.content, sectionAnns);

  return (
    <pre className="px-3 py-2 font-mono text-sm leading-5 whitespace-pre-wrap break-words">
      {segments.map((segment, idx) => {
        if (!segment.isHighlight || !segment.annotation) {
          return <span key={idx}>{segment.text}</span>;
        }
        const ann = segment.annotation;
        return (
          <span
            key={idx}
            style={{ backgroundColor: ann.classColor + "66" }}
            className="rounded-sm"
            title={`${ann.classDisplayLabel}: ${ann.tag}`}
          >
            {segment.text}
          </span>
        );
      })}
    </pre>
  );
}

export function ExportPreviewDialog({
  data,
  open,
  onOpenChange,
}: ExportPreviewDialogProps) {
  const [originalTab, setOriginalTab] = useState("email");
  const [deliveredTab, setDeliveredTab] = useState("email");

  const deidentifiedSections = useMemo(
    () => deidentifySections(data.sections, data.annotations),
    [data.sections, data.annotations],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[90vw] max-h-[85vh] flex flex-col"
        data-testid="export-preview"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {data.fileName}
            <Badge variant="outline" className="text-xs font-normal">
              {data.annotations.length} annotations
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Compare original and de-identified versions
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
          {/* Original panel */}
          <div className="flex flex-col min-h-0 border rounded-lg overflow-hidden">
            <Tabs
              value={originalTab}
              onValueChange={setOriginalTab}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">
                  Original
                </span>
                <TabsList className="h-7">
                  <TabsTrigger value="email" className="text-xs px-2 py-0.5">
                    Email
                  </TabsTrigger>
                  <TabsTrigger
                    value="text"
                    className="text-xs px-2 py-0.5"
                    data-testid="original-text-tab"
                  >
                    Text
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent
                value="email"
                className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
              >
                <ScrollArea className="h-[60vh]">
                  <EmailViewer rawContent={data.original} />
                </ScrollArea>
              </TabsContent>
              <TabsContent
                value="text"
                className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
              >
                <ScrollArea className="h-[60vh]">
                  <div data-testid="original-content">
                    {data.sections.map((section) => (
                      <div key={section.index}>
                        <SectionDivider section={section} />
                        <OriginalSectionContent
                          section={section}
                          annotations={data.annotations}
                        />
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Delivered panel */}
          <div className="flex flex-col min-h-0 border rounded-lg overflow-hidden">
            <Tabs
              value={deliveredTab}
              onValueChange={setDeliveredTab}
              className="flex flex-col flex-1 min-h-0"
            >
              <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30">
                <span className="text-xs font-medium text-muted-foreground">
                  De-identified
                </span>
                <TabsList className="h-7">
                  <TabsTrigger value="email" className="text-xs px-2 py-0.5">
                    Email
                  </TabsTrigger>
                  <TabsTrigger
                    value="text"
                    className="text-xs px-2 py-0.5"
                    data-testid="delivered-text-tab"
                  >
                    Text
                  </TabsTrigger>
                </TabsList>
              </div>
              <TabsContent
                value="email"
                className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
              >
                <ScrollArea className="h-[60vh]">
                  <EmailViewer rawContent={data.deidentified} />
                </ScrollArea>
              </TabsContent>
              <TabsContent
                value="text"
                className="flex-1 min-h-0 mt-0 data-[state=inactive]:hidden"
              >
                <ScrollArea className="h-[60vh]">
                  <div data-testid="deidentified-content">
                    {deidentifiedSections.map((section) => (
                      <div key={section.index}>
                        <SectionDivider section={section} />
                        <pre className="px-3 py-2 font-mono text-sm leading-5 whitespace-pre-wrap break-words">
                          {section.content}
                        </pre>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
