import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Ban, Save, Send, WrapText, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAnnotationClasses } from "@/features/annotation-classes/api/get-annotation-classes";
import { scrollToAnnotation } from "@/lib/offset-utils";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AnnotationsListTab } from "@/components/annotations-list-tab";
import { ClassSelectionPopup } from "@/components/class-selection-popup";
import { EmailPreview } from "@/components/email-preview";
import { EmailViewer } from "@/components/email-viewer";
import { SectionedContentViewer } from "@/components/sectioned-content-viewer";
import { DiscardJobDialog } from "@/components/discard-job-dialog";
import { SameValueLinkingDialog } from "@/components/same-value-linking-dialog";
import { JobStatus } from "@/types/enums";
import { useDiscardReasons } from "@/features/dashboard/api/get-discard-reasons-setting";
import { useSetHeaderSlot } from "@/lib/header-slot";
import { AnnotationActionToolbar } from "./annotation-action-toolbar";
import { ReworkBanner } from "./rework-banner";
import { TagReassignmentDialog } from "./tag-reassignment-dialog";
import { AutosaveIndicator } from "@/components/autosave-indicator";
import { useAnnotationWorkspace } from "../hooks/use-annotation-workspace";

interface AnnotationWorkspaceProps {
  jobId: string;
}

export function AnnotationWorkspace({ jobId }: AnnotationWorkspaceProps) {
  const workspace = useAnnotationWorkspace(jobId);
  const { data: annotationClasses } = useAnnotationClasses();
  const { data: discardReasonsData } = useDiscardReasons();
  const [wordWrap, setWordWrap] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [toolbarAnnotation, setToolbarAnnotation] = useState<import("@/types/models").WorkspaceAnnotation | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [tagReassignAnnotation, setTagReassignAnnotation] = useState<import("@/types/models").WorkspaceAnnotation | null>(null);
  const navigate = useNavigate();

  const isReadOnly = workspace.job?.status !== JobStatus.ANNOTATION_IN_PROGRESS;

  const headerBreadcrumb = useMemo(() => {
    if (!workspace.job) return null;
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/annotator/dashboard">
              Annotate
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{workspace.job.fileName}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }, [workspace.job]);

  const headerActions = useMemo(() => {
    if (!workspace.job) return null;
    return (
      <div className="flex items-center gap-2">
        {!isReadOnly && (
          <div className="flex items-center gap-2 mr-2">
            <Switch
              id="same-value-linking"
              checked={workspace.sameValueLinkingEnabled}
              onCheckedChange={workspace.setSameValueLinkingEnabled}
            />
            <Label htmlFor="same-value-linking" className="text-sm cursor-pointer">
              Link duplicates
            </Label>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/annotator/dashboard" })}
        >
          <X className="mr-1 h-4 w-4" />
          Close
        </Button>
        {!isReadOnly && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setDiscardDialogOpen(true)}
              disabled={workspace.isDiscarding}
              data-testid="discard-button"
            >
              <Ban className="mr-1 h-4 w-4" />
              Discard
            </Button>
            <AutosaveIndicator status={workspace.autosaveStatus} />
            <Button
              variant="outline"
              size="sm"
              onClick={workspace.saveDraft}
              disabled={!workspace.isDirty || workspace.isSaving}
              data-testid="save-draft-button"
            >
              <Save className="mr-1 h-4 w-4" />
              {workspace.isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              size="sm"
              onClick={() => setConfirmSubmitOpen(true)}
              disabled={workspace.isSubmitting || workspace.annotations.length === 0}
              data-testid="submit-button"
            >
              <Send className="mr-1 h-4 w-4" />
              Submit for QA
            </Button>
          </>
        )}
      </div>
    );
  }, [workspace.job, workspace.isDirty, workspace.isSaving, workspace.isSubmitting, workspace.isDiscarding, workspace.annotations.length, workspace.saveDraft, workspace.sameValueLinkingEnabled, workspace.setSameValueLinkingEnabled, workspace.autosaveStatus, navigate, isReadOnly]);

  useSetHeaderSlot(headerBreadcrumb, headerActions);

  if (workspace.isLoading) {
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-3 border-b px-4 py-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="flex flex-1 min-h-0">
          <div className="flex-1 p-4 space-y-2">
            {Array.from({ length: 20 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
          <div className="w-[40%] border-l p-4 space-y-2">
            <Skeleton className="h-8 w-48" />
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!workspace.job) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Job not found or access denied.</p>
      </div>
    );
  }

  const contentRef = document.querySelector(
    "[data-raw-content-container]",
  ) as HTMLElement | null;

  function handleAnnotationClick(id: string) {
    workspace.setSelectedAnnotationId(id);
    if (contentRef) {
      scrollToAnnotation(contentRef, id);
    }
  }

  function handleTextSelect(sel: { text: string; start: number; end: number; sectionIndex: number }) {
    // Get cursor position for popup placement
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      workspace.handleTextSelection(
        sel.text,
        sel.start,
        sel.end,
        sel.sectionIndex,
        rect.left + rect.width / 2,
        rect.bottom + 4,
      );
    }
  }

  function handleEdit(id: string) {
    setToolbarAnnotation(null);
    setEditingAnnotationId(id);
  }

  function handleEditClassSelect(cls: import("@/types/models").AnnotationClass) {
    if (editingAnnotationId) {
      workspace.editAnnotation(editingAnnotationId, cls);
      setEditingAnnotationId(null);
    }
  }

  async function handleSubmit() {
    setConfirmSubmitOpen(false);
    await workspace.submit();
  }

  return (
    <div className="flex h-full flex-col" data-testid="annotation-workspace">
      {/* Rework banner */}
      {workspace.reworkInfo && (
        <div className="px-4 pt-2">
          <ReworkBanner reworkInfo={workspace.reworkInfo} />
        </div>
      )}

      {/* Main workspace */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full" data-raw-content-container>
              <SectionedContentViewer
                sections={workspace.sections}
                annotations={workspace.annotations}
                selectedAnnotationId={workspace.selectedAnnotationId}
                onTextSelect={isReadOnly ? undefined : handleTextSelect}
                wordWrap={wordWrap}
                onAnnotationClick={(ann) => {
                  workspace.setSelectedAnnotationId(ann.id);
                  if (!isReadOnly) {
                    const container = document.querySelector("[data-raw-content-container]") as HTMLElement | null;
                    if (container) {
                      const span = container.querySelector(`[data-annotation-id="${ann.id}"]`);
                      if (span) {
                        const rect = span.getBoundingClientRect();
                        setToolbarPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
                        setToolbarAnnotation(ann);
                        return;
                      }
                    }
                    setToolbarPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
                    setToolbarAnnotation(ann);
                  }
                }}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={25}>
            <div data-testid="workspace-right-panel" className="h-full">
            <Tabs
              value={workspace.activeRightTab}
              onValueChange={workspace.setActiveRightTab}
              className="flex h-full flex-col"
            >
              <div className="flex items-center justify-between mx-2 mt-2">
                <TabsList className="w-fit">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="annotations" data-testid="annotations-list-tab">
                    Annotations ({workspace.annotations.length})
                  </TabsTrigger>
                  <TabsTrigger value="email" data-testid="email-preview-tab">Email</TabsTrigger>
                </TabsList>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Toggle
                        size="sm"
                        pressed={wordWrap}
                        onPressedChange={setWordWrap}
                        aria-label="Toggle word wrap"
                        className="h-8 w-8"
                      >
                        <WrapText className="h-4 w-4" />
                      </Toggle>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">Toggle word wrap</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <TabsContent value="preview" className="flex-1 min-h-0 m-0 overflow-auto">
                <EmailPreview rawContent={workspace.rawContent} sections={workspace.sections} annotations={workspace.annotations} />
              </TabsContent>
              <TabsContent value="annotations" className="flex-1 min-h-0 m-0">
                <AnnotationsListTab
                  annotations={workspace.annotations}
                  onAnnotationClick={handleAnnotationClick}
                  onEdit={handleEdit}
                  onDelete={workspace.deleteAnnotation}
                  showActions={!isReadOnly}
                />
              </TabsContent>
              <TabsContent value="email" className="flex-1 min-h-0 m-0 overflow-auto">
                {workspace.rawContent && (
                  <EmailViewer rawContent={workspace.rawContent} />
                )}
              </TabsContent>
            </Tabs>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Annotation action toolbar */}
      {toolbarAnnotation && !isReadOnly && (() => {
        const liveAnnotation = workspace.annotations.find((a) => a.id === toolbarAnnotation.id) ?? toolbarAnnotation;
        return (
          <AnnotationActionToolbar
            annotation={liveAnnotation}
            position={toolbarPosition}
            onEdit={() => handleEdit(liveAnnotation.id)}
            onDelete={() => workspace.deleteAnnotation(liveAnnotation.id)}
            onClose={() => setToolbarAnnotation(null)}
            onChangeTag={() => {
              setTagReassignAnnotation(liveAnnotation);
              setToolbarAnnotation(null);
            }}
            hasOtherTags={
              workspace.getExistingTagsForClass(
                liveAnnotation.className,
                liveAnnotation.tag,
              ).length > 0
            }
            onChangeTagIndex={(newIndex) => {
              workspace.changeTagIndex(liveAnnotation.id, liveAnnotation.tag, newIndex);
            }}
          />
        );
      })()}

      {/* Class selection popup */}
      {workspace.classPopupOpen && annotationClasses && (
        <ClassSelectionPopup
          position={workspace.classPopupPosition}
          classes={annotationClasses}
          onSelect={workspace.handleClassSelected}
          onClose={workspace.closeClassPopup}
        />
      )}

      {/* Edit class popup */}
      {editingAnnotationId && annotationClasses && (
        <ClassSelectionPopup
          position={{ x: window.innerWidth / 2 - 128, y: window.innerHeight / 2 - 150 }}
          classes={annotationClasses}
          onSelect={handleEditClassSelect}
          onClose={() => setEditingAnnotationId(null)}
        />
      )}

      {/* Same value dialog */}
      {workspace.sameValuePrompt && (
        <SameValueLinkingDialog
          open
          text={workspace.sameValuePrompt.text}
          existingTag={workspace.sameValuePrompt.existingTag}
          newTag={workspace.sameValuePrompt.newTag}
          similarText={workspace.sameValuePrompt.similarText}
          onUseExisting={() => workspace.handleSameValueDecision(true)}
          onCreateNew={() => workspace.handleSameValueDecision(false)}
          onCancel={workspace.cancelSameValue}
        />
      )}

      {/* Tag reassignment dialog */}
      {tagReassignAnnotation && (
        <TagReassignmentDialog
          open
          currentTag={tagReassignAnnotation.tag}
          availableTags={workspace.getExistingTagsForClass(
            tagReassignAnnotation.className,
            tagReassignAnnotation.tag,
          )}
          onSelect={(tag) => {
            workspace.reassignTag(tagReassignAnnotation.id, tag);
            setTagReassignAnnotation(null);
          }}
          onClose={() => setTagReassignAnnotation(null)}
        />
      )}

      {/* Discard dialog */}
      <DiscardJobDialog
        open={discardDialogOpen}
        onOpenChange={setDiscardDialogOpen}
        reasons={discardReasonsData?.reasons ?? []}
        isSubmitting={workspace.isDiscarding}
        onConfirm={async (reason) => {
          await workspace.discard(reason);
          setDiscardDialogOpen(false);
          navigate({ to: "/annotator/dashboard" });
        }}
      />

      {/* Submit confirmation */}
      <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
        <DialogContent data-testid="submit-confirm-dialog">
          <DialogHeader>
            <DialogTitle>Submit Annotations for QA?</DialogTitle>
            <DialogDescription>
              You are about to submit {workspace.annotations.length} annotation
              {workspace.annotations.length !== 1 ? "s" : ""} for QA review. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)} data-testid="submit-cancel">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={workspace.isSubmitting} data-testid="submit-confirm">
              {workspace.isSubmitting ? "Submitting..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
