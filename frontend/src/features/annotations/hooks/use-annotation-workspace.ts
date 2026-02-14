import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnnotationClass, EmailSection, WorkspaceAnnotation } from "@/types/models";
import { JobStatus } from "@/types/enums";
import { useAutosave } from "@/hooks/use-autosave";
import { useJobForAnnotation, useRawContent } from "../api/get-job-for-annotation";
import { useDraft } from "../api/get-draft";
import { useSaveDraft } from "../api/save-draft";
import { useSubmitAnnotation } from "../api/submit-annotation";
import { useDiscardAnnotationJob } from "../api/discard-annotation-job";

interface PendingSelection {
  text: string;
  start: number;
  end: number;
  sectionIndex: number;
  cursorX: number;
  cursorY: number;
}

interface SameValuePrompt {
  text: string;
  className: string;
  existingTag: string;
  newTag: string;
  pendingAnnotation: Omit<WorkspaceAnnotation, "id" | "tag">;
  similarText?: string;
}

function sameValueKey(className: string, text: string): string {
  return `${className}:${text.toLowerCase()}`;
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  // Use single-row DP for space efficiency
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1];
      } else {
        curr[j] = 1 + Math.min(prev[j - 1], prev[j], curr[j - 1]);
      }
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

export function useAnnotationWorkspace(jobId: string) {
  const { data: job, isLoading: jobLoading } = useJobForAnnotation(jobId);
  const { data: contentData, isLoading: contentLoading } = useRawContent(jobId);
  const { data: draftData } = useDraft(jobId);
  const saveDraftMutation = useSaveDraft();
  const submitMutation = useSubmitAnnotation();
  const discardMutation = useDiscardAnnotationJob();

  const [annotations, setAnnotations] = useState<WorkspaceAnnotation[]>([]);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string>();
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [classPopupOpen, setClassPopupOpen] = useState(false);
  const [classPopupPosition, setClassPopupPosition] = useState({ x: 0, y: 0 });
  const [sameValuePrompt, setSameValuePrompt] = useState<SameValuePrompt | null>(null);
  const [activeRightTab, setActiveRightTab] = useState("preview");
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyTick, setDirtyTick] = useState(0);
  const [sameValueLinkingEnabled, setSameValueLinkingEnabled] = useState(true);

  // Section-based content
  const sections: EmailSection[] = contentData?.sections ?? [];
  const rawContent = contentData?.rawContent ?? "";

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

  // Same-value map: "className:lowercaseText" → tag
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
      const key = sameValueKey(ann.className, ann.originalText);
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

  function peekNextTag(className: string): string {
    const current = tagCounterMap.current.get(className) ?? 0;
    return `[${className}_${current + 1}]`;
  }

  function getNextTag(className: string): string {
    const current = tagCounterMap.current.get(className) ?? 0;
    const next = current + 1;
    tagCounterMap.current.set(className, next);
    return `[${className}_${next}]`;
  }

  const handleTextSelection = useCallback(
    (text: string, start: number, end: number, sectionIndex: number, cursorX: number, cursorY: number) => {
      setPendingSelection({ text, start, end, sectionIndex, cursorX, cursorY });
      setClassPopupPosition({ x: cursorX, y: cursorY });
      setClassPopupOpen(true);
    },
    [],
  );

  const handleClassSelected = useCallback(
    (cls: AnnotationClass) => {
      if (!pendingSelection) return;

      setClassPopupOpen(false);
      const { text, start, end, sectionIndex } = pendingSelection;

      const validationError = validateAnnotationText(text);
      if (validationError) {
        toast.error(validationError);
        setPendingSelection(null);
        window.getSelection()?.removeAllRanges();
        return;
      }

      // Check same-value map (case-insensitive)
      const key = sameValueKey(cls.name, text);
      const existingTag = sameValueMap.current.get(key);

      if (existingTag) {
        if (!sameValueLinkingEnabled) {
          // Auto-assign new tag, skip dialog — actually increment counter
          const newTag = getNextTag(cls.name);
          const annotation: WorkspaceAnnotation = {
            id: crypto.randomUUID(),
            classId: cls.id,
            className: cls.name,
            classColor: cls.color,
            classDisplayLabel: cls.displayLabel,
            tag: newTag,
            sectionIndex,
            startOffset: start,
            endOffset: end,
            originalText: text,
          };
          sameValueMap.current.set(key, newTag);
          setAnnotations((prev) => [...prev, annotation]);
          setIsDirty(true);
      setDirtyTick((t) => t + 1);
          setPendingSelection(null);
          window.getSelection()?.removeAllRanges();
          return;
        }
        // Show same-value dialog — peek only, don't increment yet
        setSameValuePrompt({
          text,
          className: cls.name,
          existingTag,
          newTag: peekNextTag(cls.name),
          pendingAnnotation: {
            classId: cls.id,
            className: cls.name,
            classColor: cls.color,
            classDisplayLabel: cls.displayLabel,
            sectionIndex,
            startOffset: start,
            endOffset: end,
            originalText: text,
          },
        });
        return;
      }

      // No exact match — try fuzzy matching if linking is enabled
      if (sameValueLinkingEnabled) {
        const textLower = text.toLowerCase();
        let bestMatch: { existingText: string; tag: string; distance: number } | null = null;

        // Collect unique (originalText, tag) pairs for this class
        const seen = new Set<string>();
        for (const ann of annotations) {
          if (ann.className !== cls.name) continue;
          const annTextLower = ann.originalText.toLowerCase();
          if (seen.has(annTextLower)) continue;
          seen.add(annTextLower);

          const distance = levenshteinDistance(textLower, annTextLower);
          const maxLen = Math.max(textLower.length, annTextLower.length);
          if (distance > 0 && distance <= 2 && maxLen > 0 && distance / maxLen <= 0.35) {
            if (!bestMatch || distance < bestMatch.distance) {
              bestMatch = { existingText: ann.originalText, tag: ann.tag, distance };
            }
          }
        }

        if (bestMatch) {
          // Fuzzy match dialog — peek only, don't increment yet
          setSameValuePrompt({
            text,
            className: cls.name,
            existingTag: bestMatch.tag,
            newTag: peekNextTag(cls.name),
            pendingAnnotation: {
              classId: cls.id,
              className: cls.name,
              classColor: cls.color,
              classDisplayLabel: cls.displayLabel,
              sectionIndex,
              startOffset: start,
              endOffset: end,
              originalText: text,
            },
            similarText: bestMatch.existingText,
          });
          return;
        }
      }

      // No match at all — actually increment and create
      const newTag = getNextTag(cls.name);
      const annotation: WorkspaceAnnotation = {
        id: crypto.randomUUID(),
        classId: cls.id,
        className: cls.name,
        classColor: cls.color,
        classDisplayLabel: cls.displayLabel,
        tag: newTag,
        sectionIndex,
        startOffset: start,
        endOffset: end,
        originalText: text,
      };

      sameValueMap.current.set(key, newTag);
      setAnnotations((prev) => [...prev, annotation]);
      setIsDirty(true);
      setDirtyTick((t) => t + 1);
      setPendingSelection(null);
      window.getSelection()?.removeAllRanges();
    },
    [pendingSelection, sameValueLinkingEnabled, minAnnotationLength, annotations],
  );

  const handleSameValueDecision = useCallback(
    (useExisting: boolean) => {
      if (!sameValuePrompt) return;

      const { pendingAnnotation, existingTag, className, text } =
        sameValuePrompt;

      // Only increment the counter when user actually chooses a new tag
      const tag = useExisting ? existingTag : getNextTag(className);

      if (!useExisting) {
        sameValueMap.current.set(sameValueKey(className, text), tag);
      }

      const annotation: WorkspaceAnnotation = {
        id: crypto.randomUUID(),
        ...pendingAnnotation,
        tag,
      };

      setAnnotations((prev) => [...prev, annotation]);
      setIsDirty(true);
      setDirtyTick((t) => t + 1);
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
          const oldKey = sameValueKey(ann.className, ann.originalText);
          sameValueMap.current.delete(oldKey);

          const newTag = getNextTag(newCls.name);
          const newKey = sameValueKey(newCls.name, ann.originalText);
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
      setDirtyTick((t) => t + 1);
    },
    [],
  );

  const deleteAnnotation = useCallback((id: string) => {
    setAnnotations((prev) => {
      const ann = prev.find((a) => a.id === id);
      if (ann) {
        const key = sameValueKey(ann.className, ann.originalText);
        // Only remove from map if this is the last annotation with that key+tag
        const remaining = prev.filter(
          (a) => a.id !== id && sameValueKey(a.className, a.originalText) === key,
        );
        if (remaining.length === 0) {
          sameValueMap.current.delete(key);
        }
      }
      return prev.filter((a) => a.id !== id);
    });
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const reassignTag = useCallback((annotationId: string, newTag: string) => {
    setAnnotations((prev) =>
      prev.map((ann) => {
        if (ann.id !== annotationId) return ann;
        const key = sameValueKey(ann.className, ann.originalText);
        sameValueMap.current.set(key, newTag);
        return { ...ann, tag: newTag };
      }),
    );
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const changeTagIndex = useCallback((annotationId: string, currentTag: string, newIndex: number) => {
    const tagMatch = currentTag.match(/\[(\w+)_(\d+)\]/);
    if (!tagMatch) return;
    const className = tagMatch[1];
    const newTag = `[${className}_${newIndex}]`;

    setAnnotations((prev) =>
      prev.map((ann) => {
        if (ann.id !== annotationId) return ann;
        const key = sameValueKey(ann.className, ann.originalText);
        sameValueMap.current.set(key, newTag);
        return { ...ann, tag: newTag };
      }),
    );
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const getExistingTagsForClass = useCallback(
    (className: string, excludeTag: string): { tag: string; sampleText: string }[] => {
      const tagMap = new Map<string, string>();
      for (const ann of annotations) {
        if (ann.className !== className) continue;
        if (ann.tag === excludeTag) continue;
        if (!tagMap.has(ann.tag)) {
          tagMap.set(ann.tag, ann.originalText);
        }
      }
      return Array.from(tagMap.entries()).map(([tag, sampleText]) => ({
        tag,
        sampleText,
      }));
    },
    [annotations],
  );

  const discard = useCallback(async (reason: string) => {
    await discardMutation.mutateAsync({
      jobId,
      reason,
      expectedStatus: job?.status,
    });
  }, [jobId, job?.status, discardMutation]);

  // Silent save for autosave (no toast) — defined as ref-stable callback
  const saveDraftSilentRef = useRef<(() => Promise<void>) | undefined>(undefined);
  saveDraftSilentRef.current = async () => {
    await saveDraftMutation.mutateAsync({ jobId, annotations });
    setIsDirty(false);
  };
  const saveDraftSilentStable = useCallback(async () => {
    await saveDraftSilentRef.current?.();
  }, []);

  const { autosaveStatus, cancelPendingAutosave } = useAutosave({
    saveFn: saveDraftSilentStable,
    isDirty,
    isSaving: saveDraftMutation.isPending,
    dirtyTick,
    enabled: job?.status === JobStatus.ANNOTATION_IN_PROGRESS,
  });

  // Manual save: cancel pending autosave, save, show toast
  const saveDraft = useCallback(async () => {
    cancelPendingAutosave();
    await saveDraftMutation.mutateAsync({ jobId, annotations });
    setIsDirty(false);
    toast.success("Draft saved");
  }, [jobId, annotations, saveDraftMutation, cancelPendingAutosave]);

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
    sections,
    rawContent,
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
    autosaveStatus,
    isSubmitting: submitMutation.isPending,
    isDiscarding: discardMutation.isPending,
    isSaving: saveDraftMutation.isPending,
    handleTextSelection,
    handleClassSelected,
    handleSameValueDecision,
    editAnnotation,
    deleteAnnotation,
    reassignTag,
    changeTagIndex,
    getExistingTagsForClass,
    sameValueLinkingEnabled,
    setSameValueLinkingEnabled,
    saveDraft,
    submit,
    discard,
  };
}
