import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, Save, X, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAnnotationClasses } from "@/features/annotation-classes/api/get-annotation-classes";
import { scrollToAnnotation } from "@/lib/offset-utils";
import { AnnotationQAStatus, JobStatus } from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClassSelectionPopup } from "@/components/class-selection-popup";
import { EmailPreview } from "@/components/email-preview";
import { EmailViewer } from "@/components/email-viewer";
import { RawContentViewer } from "@/components/raw-content-viewer";
import { useSetHeaderSlot } from "@/lib/header-slot";
import { TagReassignmentDialog } from "@/features/annotations/components/tag-reassignment-dialog";
import { AcceptDialog } from "./accept-dialog";
import { AnnotationActionToolbar } from "./annotation-action-toolbar";
import { AnnotationsReviewListTab } from "./annotations-review-list-tab";
import { EditModeControls } from "./edit-mode-controls";
import { RejectDialog } from "./reject-dialog";
import { useQAReview } from "../hooks/use-qa-review";

interface QAReviewWorkspaceProps {
  jobId: string;
}

export function QAReviewWorkspace({ jobId }: QAReviewWorkspaceProps) {
  const review = useQAReview(jobId);
  const { data: annotationClasses } = useAnnotationClasses();
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [toolbarAnnotation, setToolbarAnnotation] = useState<import("@/types/models").WorkspaceAnnotation | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [tagReassignAnnotation, setTagReassignAnnotation] = useState<import("@/types/models").WorkspaceAnnotation | null>(null);
  const [classPopupOpen, setClassPopupOpen] = useState(false);
  const [classPopupPosition, setClassPopupPosition] = useState({ x: 0, y: 0 });
  const [pendingTextSelection, setPendingTextSelection] = useState<{
    text: string;
    start: number;
    end: number;
  } | null>(null);
  const navigate = useNavigate();

  const headerBreadcrumb = useMemo(() => {
    if (!review.job) return null;
    const secondaryText = review.annotatorInfo
      ? `Annotator: ${review.annotatorInfo.name}`
      : review.blindReviewEnabled
        ? "[Blind Review]"
        : null;
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/qa/dashboard">QA Review</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{review.job.fileName}</BreadcrumbPage>
          </BreadcrumbItem>
          {secondaryText && (
            <>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <span className="text-xs text-muted-foreground">
                  {secondaryText}
                </span>
              </BreadcrumbItem>
            </>
          )}
        </BreadcrumbList>
      </Breadcrumb>
    );
  }, [review.job, review.annotatorInfo, review.blindReviewEnabled]);

  const isReadOnly = review.job?.status === JobStatus.QA_ACCEPTED
    || review.job?.status === JobStatus.QA_REJECTED
    || review.job?.status === JobStatus.DELIVERED;

  const headerActions = useMemo(() => {
    if (!review.job) return null;
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/qa/dashboard" })}
        >
          <X className="mr-1 h-4 w-4" />
          Close
        </Button>
        {!isReadOnly && (
          <>
            <EditModeControls
              enabled={review.editModeEnabled}
              onToggle={review.toggleEditMode}
              modificationCount={review.modifications.length}
            />
            <Separator orientation="vertical" className="h-6" />
            <Button
              variant="outline"
              size="sm"
              onClick={review.saveDraft}
              disabled={!review.isDirty || review.isSaving}
              data-testid="save-draft-button"
            >
              <Save className="mr-1 h-4 w-4" />
              {review.isSaving ? "Saving..." : "Save Draft"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setRejectDialogOpen(true)}
              disabled={review.isRejecting}
              data-testid="reject-button"
            >
              <XCircle className="mr-1 h-4 w-4" />
              Reject
            </Button>
            <Button
              size="sm"
              onClick={() => setAcceptDialogOpen(true)}
              disabled={review.isAccepting}
              data-testid="accept-button"
            >
              <Check className="mr-1 h-4 w-4" />
              Accept
            </Button>
          </>
        )}
      </div>
    );
  }, [
    review.job,
    isReadOnly,
    review.editModeEnabled,
    review.toggleEditMode,
    review.modifications.length,
    review.isDirty,
    review.isSaving,
    review.saveDraft,
    review.isRejecting,
    review.isAccepting,
    navigate,
  ]);

  useSetHeaderSlot(headerBreadcrumb, headerActions);

  if (review.isLoading) {
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

  if (!review.job) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-destructive">Job not found or access denied.</p>
      </div>
    );
  }

  // Convert annotationStatuses to string map for RawContentViewer
  const statusStringMap = new Map<string, string>();
  review.annotationStatuses.forEach((status, id) => {
    statusStringMap.set(id, status);
  });

  function handleAnnotationClick(id: string) {
    review.setSelectedAnnotationId(id);
    const container = document.querySelector("[data-raw-content-container]") as HTMLElement | null;
    if (container) {
      scrollToAnnotation(container, id);
    }
  }

  function handleAnnotationClickInViewer(ann: import("@/types/models").WorkspaceAnnotation) {
    review.setSelectedAnnotationId(ann.id);
    // Show the action toolbar positioned below the clicked annotation span
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
    // Fallback: center of screen
    setToolbarPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setToolbarAnnotation(ann);
  }

  function handleTextSelect(sel: { text: string; start: number; end: number }) {
    if (!review.editModeEnabled) return;
    setToolbarAnnotation(null);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setPendingTextSelection(sel);
      setClassPopupPosition({ x: rect.left + rect.width / 2, y: rect.bottom + 4 });
      setClassPopupOpen(true);
    }
  }

  function handleClassSelectForAdd(cls: import("@/types/models").AnnotationClass) {
    if (pendingTextSelection) {
      review.addAnnotation(
        pendingTextSelection.text,
        pendingTextSelection.start,
        pendingTextSelection.end,
        cls,
      );
      setPendingTextSelection(null);
      setClassPopupOpen(false);
    }
  }

  function handleToolbarEdit(id: string) {
    setEditingAnnotationId(id);
  }

  function handleEditClassSelect(cls: import("@/types/models").AnnotationClass) {
    if (editingAnnotationId) {
      review.editAnnotation(editingAnnotationId, cls);
      setEditingAnnotationId(null);
    }
  }

  async function handleAccept(comments: string) {
    await review.accept(comments);
    setAcceptDialogOpen(false);
    navigate({ to: "/qa/dashboard" });
  }

  async function handleReject(comments: string) {
    await review.reject(comments);
    setRejectDialogOpen(false);
    navigate({ to: "/qa/dashboard" });
  }

  const modSummary = review.getModificationSummary();

  return (
    <div className="flex h-full flex-col" data-testid="qa-review-workspace">
      {/* Main workspace */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal">
          <ResizablePanel defaultSize={60} minSize={30}>
            <div className="h-full" data-raw-content-container>
              <RawContentViewer
                content={review.displayContent}
                annotations={review.currentAnnotations}
                selectedAnnotationId={review.selectedAnnotationId}
                onTextSelect={review.isViewingOriginal ? undefined : handleTextSelect}
                onAnnotationClick={review.isViewingOriginal ? undefined : handleAnnotationClickInViewer}
                readOnly={!review.editModeEnabled}
                annotationStatuses={statusStringMap}
                hasEncodedParts={review.hasEncodedParts}
                contentViewMode={review.contentViewMode}
                onContentViewModeChange={review.setContentViewMode}
                isViewingOriginal={review.isViewingOriginal}
              />
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={25} data-testid="qa-right-panel">
            <Tabs
              value={review.activeRightTab}
              onValueChange={review.setActiveRightTab}
              className="flex h-full flex-col"
            >
              <TabsList className="mx-2 mt-2 w-fit">
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="annotations" data-testid="annotations-tab-trigger">
                  Annotations ({review.currentAnnotations.length})
                </TabsTrigger>
                <TabsTrigger value="email">Email</TabsTrigger>
              </TabsList>
              <TabsContent value="preview" className="flex-1 min-h-0 m-0 overflow-auto">
                {review.rawContent && (
                  <EmailPreview rawContent={review.rawContent} annotations={review.currentAnnotations} />
                )}
              </TabsContent>
              <TabsContent value="annotations" className="flex-1 min-h-0 m-0">
                <AnnotationsReviewListTab
                  annotations={review.currentAnnotations}
                  annotationStatuses={review.annotationStatuses}
                  annotationNotes={review.annotationNotes}
                  onAnnotationClick={handleAnnotationClick}
                  onSetNote={review.setAnnotationNote}
                  showActions={!isReadOnly}
                  editMode={review.editModeEnabled}
                  onMarkOK={review.markOK}
                  onFlag={review.flagAnnotation}
                  onEdit={handleToolbarEdit}
                  onDelete={review.deleteAnnotation}
                />
              </TabsContent>
              <TabsContent value="email" className="flex-1 min-h-0 m-0 overflow-auto">
                {review.rawContent && (
                  <EmailViewer rawContent={review.rawContent} />
                )}
              </TabsContent>
            </Tabs>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Annotation action toolbar */}
      {toolbarAnnotation && !isReadOnly && (
        <AnnotationActionToolbar
          annotation={toolbarAnnotation}
          status={review.annotationStatuses.get(toolbarAnnotation.id) ?? AnnotationQAStatus.PENDING}
          position={toolbarPosition}
          editMode={review.editModeEnabled}
          onMarkOK={() => review.markOK(toolbarAnnotation.id)}
          onFlag={() => review.flagAnnotation(toolbarAnnotation.id)}
          onEdit={() => handleToolbarEdit(toolbarAnnotation.id)}
          onChangeTag={review.editModeEnabled ? () => setTagReassignAnnotation(toolbarAnnotation) : undefined}
          hasOtherTags={review.editModeEnabled ? review.getExistingTagsForClass(toolbarAnnotation.className, toolbarAnnotation.tag).length > 0 : false}
          onDelete={() => review.deleteAnnotation(toolbarAnnotation.id)}
          onClose={() => setToolbarAnnotation(null)}
        />
      )}

      {/* Class selection popup for edit mode (add new annotations) */}
      {classPopupOpen && annotationClasses && (
        <ClassSelectionPopup
          position={classPopupPosition}
          classes={annotationClasses}
          onSelect={handleClassSelectForAdd}
          onClose={() => {
            setClassPopupOpen(false);
            setPendingTextSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
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

      {/* Tag reassignment dialog */}
      {tagReassignAnnotation && (
        <TagReassignmentDialog
          open={!!tagReassignAnnotation}
          currentTag={tagReassignAnnotation.tag}
          availableTags={review.getExistingTagsForClass(tagReassignAnnotation.className, tagReassignAnnotation.tag)}
          onSelect={(tag) => {
            review.reassignTag(tagReassignAnnotation.id, tag);
            setTagReassignAnnotation(null);
          }}
          onClose={() => setTagReassignAnnotation(null)}
        />
      )}

      {/* Accept dialog */}
      <AcceptDialog
        open={acceptDialogOpen}
        onOpenChange={setAcceptDialogOpen}
        modificationSummary={modSummary}
        hasModifications={review.hasModifications}
        isSubmitting={review.isAccepting}
        onConfirm={handleAccept}
      />

      {/* Reject dialog */}
      <RejectDialog
        open={rejectDialogOpen}
        onOpenChange={setRejectDialogOpen}
        isSubmitting={review.isRejecting}
        onConfirm={handleReject}
      />
    </div>
  );
}
