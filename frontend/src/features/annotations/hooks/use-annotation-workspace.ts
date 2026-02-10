import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnnotationClass, WorkspaceAnnotation } from "@/types/models";
import { ContentViewMode } from "@/types/enums";
import { useJobForAnnotation, useRawContent } from "../api/get-job-for-annotation";
import { useDraft } from "../api/get-draft";
import { useSaveDraft } from "../api/save-draft";
import { useSubmitAnnotation } from "../api/submit-annotation";

interface PendingSelection {
  text: string;
  start: number;
  end: number;
  cursorX: number;
  cursorY: number;
}

interface SameValuePrompt {
  text: string;
  className: string;
  existingTag: string;
  newTag: string;
  pendingAnnotation: Omit<WorkspaceAnnotation, "id" | "tag">;
}

export function useAnnotationWorkspace(jobId: string) {
  const { data: job, isLoading: jobLoading } = useJobForAnnotation(jobId);
  const { data: contentData, isLoading: contentLoading } = useRawContent(jobId);
  const { data: draftData } = useDraft(jobId);
  const saveDraftMutation = useSaveDraft();
  const submitMutation = useSubmitAnnotation();

  const [annotations, setAnnotations] = useState<WorkspaceAnnotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string>();
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [classPopupOpen, setClassPopupOpen] = useState(false);
  const [classPopupPosition, setClassPopupPosition] = useState({ x: 0, y: 0 });
  const [sameValuePrompt, setSameValuePrompt] = useState<SameValuePrompt | null>(null);
  const [activeRightTab, setActiveRightTab] = useState("annotations");
  const [isDirty, setIsDirty] = useState(false);
  const [contentViewMode, setContentViewMode] = useState<ContentViewMode>(ContentViewMode.DECODED);
  const [sameValueLinkingEnabled, setSameValueLinkingEnabled] = useState(true);

  // Derived content values
  const normalizedContent = (contentData?.normalizedContent ?? "").replace(/\r/g, "");
  const originalContent = contentData?.rawContent ?? "";
  const hasEncodedParts = contentData?.hasEncodedParts ?? false;
  const isViewingOriginal = contentViewMode === ContentViewMode.ORIGINAL;
  const displayContent = isViewingOriginal ? originalContent : normalizedContent;

  const minAnnotationLength = job?.minAnnotationLength ?? 1;

  function validateAnnotationText(text: string): string | null {
    const stripped = text.trim();
    if (!stripped) {
      return "Selection cannot be empty or blank.";
    }
    if (stripped.length < minAnnotationLength) {
      return `Selection must be at least ${minAnnotationLength} characters (got ${stripped.length}).`;
    }
    return null;
  }

  // Same-value map: "className:originalText" → tag
  const sameValueMap = useRef(new Map<string, string>());
  // Tag counter: className → highest used index
  const tagCounterMap = useRef(new Map<string, number>());
  const initialized = useRef(false);

  // Initialize annotations from draft or latest version
  useEffect(() => {
    if (initialized.current) return;

    // Try draft first
    if (draftData?.annotations && draftData.annotations.length > 0) {
      const draftAnns = draftData.annotations as WorkspaceAnnotation[];
      setAnnotations(draftAnns);
      buildMapsFromAnnotations(draftAnns);
      initialized.current = true;
      return;
    }

    // Fallback to latest annotations from server (rework case)
    if (job?.latestAnnotations && job.latestAnnotations.length > 0) {
      const serverAnns = job.latestAnnotations.map((ann) => ({
        ...ann,
        id: ann.id || crypto.randomUUID(),
      }));
      setAnnotations(serverAnns);
      buildMapsFromAnnotations(serverAnns);
      initialized.current = true;
      return;
    }

    // No existing data — start fresh
    if (job && draftData) {
      initialized.current = true;
    }
  }, [job, draftData]);

  function buildMapsFromAnnotations(anns: WorkspaceAnnotation[]) {
    sameValueMap.current.clear();
    tagCounterMap.current.clear();

    for (const ann of anns) {
      const key = `${ann.className}:${ann.originalText}`;
      sameValueMap.current.set(key, ann.tag);

      const tagMatch = ann.tag.match(/\[(\w+)_(\d+)\]/);
      if (tagMatch) {
        const className = tagMatch[1];
        const index = parseInt(tagMatch[2], 10);
        const current = tagCounterMap.current.get(className) ?? 0;
        if (index > current) {
          tagCounterMap.current.set(className, index);
        }
      }
    }
  }

  function getNextTag(className: string): string {
    const current = tagCounterMap.current.get(className) ?? 0;
    const next = current + 1;
    tagCounterMap.current.set(className, next);
    return `[${className}_${next}]`;
  }

  const handleTextSelection = useCallback(
    (text: string, start: number, end: number, cursorX: number, cursorY: number) => {
      setPendingSelection({ text, start, end, cursorX, cursorY });
      setClassPopupPosition({ x: cursorX, y: cursorY });
      setClassPopupOpen(true);
    },
    [],
  );

  const handleClassSelected = useCallback(
    (cls: AnnotationClass) => {
      if (!pendingSelection) return;

      setClassPopupOpen(false);
      const { text, start, end } = pendingSelection;

      const validationError = validateAnnotationText(text);
      if (validationError) {
        toast.error(validationError);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
        return;
      }

      // Check same-value map
      const key = `${cls.name}:${text}`;
      const existingTag = sameValueMap.current.get(key);
      const newTag = getNextTag(cls.name);

      if (existingTag) {
        if (!sameValueLinkingEnabled) {
          // Auto-assign new tag, skip dialog
          const annotation: WorkspaceAnnotation = {
            id: crypto.randomUUID(),
            classId: cls.id,
            className: cls.name,
            classColor: cls.color,
            classDisplayLabel: cls.displayLabel,
            tag: newTag,
            startOffset: start,
            endOffset: end,
            originalText: text,
          };
          sameValueMap.current.set(key, newTag);
          setAnnotations((prev) => [...prev, annotation]);
          setIsDirty(true);
          setPendingSelection(null);
          window.getSelection()?.removeAllRanges();
          return;
        }
        // Show same-value dialog
        setSameValuePrompt({
          text,
          className: cls.name,
          existingTag,
          newTag,
          pendingAnnotation: {
            classId: cls.id,
            className: cls.name,
            classColor: cls.color,
            classDisplayLabel: cls.displayLabel,
            startOffset: start,
            endOffset: end,
            originalText: text,
          },
        });
        return;
      }

      // No existing match — create with new tag
      const annotation: WorkspaceAnnotation = {
        id: crypto.randomUUID(),
        classId: cls.id,
        className: cls.name,
        classColor: cls.color,
        classDisplayLabel: cls.displayLabel,
        tag: newTag,
        startOffset: start,
        endOffset: end,
        originalText: text,
      };

      sameValueMap.current.set(key, newTag);
      setAnnotations((prev) => [...prev, annotation]);
      setIsDirty(true);
      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [pendingSelection, sameValueLinkingEnabled, minAnnotationLength],
  );

  const handleSameValueDecision = useCallback(
    (useExisting: boolean) => {
      if (!sameValuePrompt) return;

      const { pendingAnnotation, existingTag, newTag, className, text } =
        sameValuePrompt;
      const tag = useExisting ? existingTag : newTag;

      if (!useExisting) {
        // Already incremented in getNextTag, need to set map
        sameValueMap.current.set(`${className}:${text}`, newTag);
      }

      const annotation: WorkspaceAnnotation = {
        id: crypto.randomUUID(),
        ...pendingAnnotation,
        tag,
      };

      setAnnotations((prev) => [...prev, annotation]);
      setIsDirty(true);
      setSameValuePrompt(null);
      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [sameValuePrompt],
  );

  const editAnnotation = useCallback(
    (id: string, newCls: AnnotationClass) => {
      setAnnotations((prev) =>
        prev.map((ann) => {
          if (ann.id !== id) return ann;
          // Remove old from same-value map
          const oldKey = `${ann.className}:${ann.originalText}`;
          sameValueMap.current.delete(oldKey);

          const newTag = getNextTag(newCls.name);
          const newKey = `${newCls.name}:${ann.originalText}`;
          sameValueMap.current.set(newKey, newTag);

          return {
            ...ann,
            classId: newCls.id,
            className: newCls.name,
            classColor: newCls.color,
            classDisplayLabel: newCls.displayLabel,
            tag: newTag,
          };
        }),
      );
      setIsDirty(true);
    },
    [],
  );

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => {
      const ann = prev.find((a) => a.id === id);
      if (ann) {
        const key = `${ann.className}:${ann.originalText}`;
        // Only remove from map if this is the last annotation with that key+tag
        const remaining = prev.filter(
          (a) => a.id !== id && `${a.className}:${a.originalText}` === key,
        );
        if (remaining.length === 0) {
          sameValueMap.current.delete(key);
        }
      }
      return prev.filter((a) => a.id !== id);
    });
    setIsDirty(true);
  }, []);

  const saveDraft = useCallback(async () => {
    await saveDraftMutation.mutateAsync({ jobId, annotations });
    setIsDirty(false);
  }, [jobId, annotations, saveDraftMutation]);

  const submit = useCallback(async () => {
    const invalidAnnotations = annotations
      .map((ann, i) => ({ index: i, error: validateAnnotationText(ann.originalText) }))
      .filter((r) => r.error !== null);
    if (invalidAnnotations.length > 0) {
      toast.error(
        `Cannot submit: ${invalidAnnotations.length} annotation(s) have invalid text. ${invalidAnnotations[0].error}`,
      );
      return;
    }
    await submitMutation.mutateAsync({ jobId, annotations });
    setIsDirty(false);
  }, [jobId, annotations, submitMutation, minAnnotationLength]);

  const closeClassPopup = useCallback(() => {
    setClassPopupOpen(false);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const cancelSameValue = useCallback(() => {
    setSameValuePrompt(null);
    setPendingSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  return {
    job,
    rawContent: normalizedContent,
    displayContent,
    hasEncodedParts,
    contentViewMode,
    setContentViewMode,
    isViewingOriginal,
    isLoading: jobLoading || contentLoading,
    reworkInfo: job?.reworkInfo ?? null,
    annotations,
    selectedAnnotationId,
    setSelectedAnnotationId,
    classPopupOpen,
    classPopupPosition,
    closeClassPopup,
    sameValuePrompt,
    cancelSameValue,
    activeRightTab,
    setActiveRightTab,
    isDirty,
    isSubmitting: submitMutation.isPending,
    isSaving: saveDraftMutation.isPending,
    handleTextSelection,
    handleClassSelected,
    handleSameValueDecision,
    editAnnotation,
    deleteAnnotation,
    sameValueLinkingEnabled,
    setSameValueLinkingEnabled,
    saveDraft,
    submit,
  };
}
