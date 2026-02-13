import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import type { AnnotationClass, EmailSection, WorkspaceAnnotation } from "@/types/models";
import { AnnotationQAStatus, JobStatus } from "@/types/enums";
import { useAutosave } from "@/hooks/use-autosave";
import {
  useJobForQAReview,
  useQARawContent,
} from "../api/get-job-for-qa-review";
import { useBlindReviewSetting } from "../api/get-blind-review-setting";
import {
  useAcceptAnnotation,
  type QAModification,
} from "../api/accept-annotation";
import { useRejectAnnotation } from "../api/reject-annotation";
import { useDiscardQAJob } from "../api/discard-qa-job";
import { useQADraft } from "../api/get-qa-draft";
import { useSaveQADraft } from "../api/save-qa-draft";

export function useQAReview(jobId: string) {
  const { data: job, isLoading: jobLoading } = useJobForQAReview(jobId);
  const { data: contentData, isLoading: contentLoading } = useQARawContent(jobId);
  const { data: blindReviewData } = useBlindReviewSetting();
  const { data: draftData, isLoading: draftLoading } = useQADraft(jobId);
  const acceptMutation = useAcceptAnnotation();
  const rejectMutation = useRejectAnnotation();
  const discardMutation = useDiscardQAJob();
  const saveDraftMutation = useSaveQADraft();

  const [originalAnnotations, setOriginalAnnotations] = useState<WorkspaceAnnotation[]>([]);
  const [currentAnnotations, setCurrentAnnotations] = useState<WorkspaceAnnotation[]>([]);
  const [annotationStatuses, setAnnotationStatuses] = useState<Map<string, AnnotationQAStatus>>(new Map());
  const [annotationNotes, setAnnotationNotes] = useState<Map<string, string>>(new Map());
  const [modifications, setModifications] = useState<QAModification[]>([]);
  const [editModeEnabled, setEditModeEnabled] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState("preview");
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string>();
  const [isDirty, setIsDirty] = useState(false);
  const [dirtyTick, setDirtyTick] = useState(0);

  // Section-based content
  const sections: EmailSection[] = contentData?.sections ?? [];
  const rawContent = contentData?.rawContent ?? "";

  // Tag counter for QA-added annotations
  const tagCounterMap = useRef(new Map<string, number>());
  const initialized = useRef(false);

  const blindReviewEnabled = blindReviewData?.enabled ?? false;

  useEffect(() => {
    if (initialized.current || !job || draftLoading) return;

    const anns = job.annotations.map((ann) => ({
      ...ann,
      id: ann.id || crypto.randomUUID(),
    }));
    setOriginalAnnotations(anns);

    // Check if we have a draft to restore
    const draft = draftData?.data;
    if (draft && Object.keys(draft).length > 0) {
      // Restore from draft
      if (Array.isArray(draft.annotations)) {
        setCurrentAnnotations(draft.annotations as WorkspaceAnnotation[]);
      } else {
        setCurrentAnnotations(anns);
      }

      if (draft.statuses && typeof draft.statuses === "object") {
        const statusMap = new Map<string, AnnotationQAStatus>();
        for (const [id, s] of Object.entries(draft.statuses as Record<string, string>)) {
          statusMap.set(id, s as AnnotationQAStatus);
        }
        setAnnotationStatuses(statusMap);
      } else {
        // Initialize all as PENDING
        const statuses = new Map<string, AnnotationQAStatus>();
        for (const ann of anns) {
          statuses.set(ann.id, AnnotationQAStatus.PENDING);
        }
        setAnnotationStatuses(statuses);
      }

      if (draft.notes && typeof draft.notes === "object") {
        const noteMap = new Map<string, string>();
        for (const [id, note] of Object.entries(draft.notes as Record<string, string>)) {
          noteMap.set(id, note);
        }
        setAnnotationNotes(noteMap);
      }

      if (Array.isArray(draft.modifications)) {
        setModifications(draft.modifications as QAModification[]);
      }

      if (typeof draft.editModeEnabled === "boolean") {
        setEditModeEnabled(draft.editModeEnabled);
      }
    } else {
      // Fresh init from server annotations
      setCurrentAnnotations(anns);
      const statuses = new Map<string, AnnotationQAStatus>();
      for (const ann of anns) {
        statuses.set(ann.id, AnnotationQAStatus.PENDING);
      }
      setAnnotationStatuses(statuses);
    }

    // Build tag counter from whichever annotations we ended up with
    const annsToCount = (draft && Array.isArray(draft.annotations))
      ? (draft.annotations as WorkspaceAnnotation[])
      : anns;
    for (const ann of annsToCount) {
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

    initialized.current = true;
  }, [job, draftData, draftLoading]);

  function getNextTag(className: string): string {
    const current = tagCounterMap.current.get(className) ?? 0;
    const next = current + 1;
    tagCounterMap.current.set(className, next);
    return `[${className}_${next}]`;
  }

  const markOK = useCallback((id: string) => {
    setAnnotationStatuses((prev) => {
      const next = new Map(prev);
      next.set(id, AnnotationQAStatus.OK);
      return next;
    });
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const flagAnnotation = useCallback((id: string, note?: string) => {
    setAnnotationStatuses((prev) => {
      const next = new Map(prev);
      next.set(id, AnnotationQAStatus.FLAGGED);
      return next;
    });
    if (note) {
      setAnnotationNotes((prev) => {
        const next = new Map(prev);
        next.set(id, note);
        return next;
      });
    }
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const editAnnotation = useCallback(
    (id: string, newCls: AnnotationClass) => {
      setCurrentAnnotations((prev) =>
        prev.map((ann) => {
          if (ann.id !== id) return ann;
          const newTag = getNextTag(newCls.name);
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
      setAnnotationStatuses((prev) => {
        const next = new Map(prev);
        // If was already QA_ADDED, keep it; otherwise mark as OK (modified)
        if (prev.get(id) !== AnnotationQAStatus.QA_ADDED) {
          next.set(id, AnnotationQAStatus.OK);
        }
        return next;
      });
      setModifications((prev) => [
        ...prev,
        { type: "modified", annotationId: id, description: `Changed class to ${newCls.name}` },
      ]);
      setIsDirty(true);
    setDirtyTick((t) => t + 1);
      setDirtyTick((t) => t + 1);
    },
    [],
  );

  const deleteAnnotation = useCallback((id: string) => {
    setCurrentAnnotations((prev) => prev.filter((a) => a.id !== id));
    setAnnotationStatuses((prev) => {
      const next = new Map(prev);
      next.set(id, AnnotationQAStatus.DELETED);
      return next;
    });
    setModifications((prev) => [
      ...prev,
      { type: "deleted", annotationId: id, description: "Deleted annotation" },
    ]);
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const addAnnotation = useCallback(
    (text: string, start: number, end: number, sectionIndex: number, cls: AnnotationClass) => {
      const tag = getNextTag(cls.name);
      const newAnn: WorkspaceAnnotation = {
        id: crypto.randomUUID(),
        classId: cls.id,
        className: cls.name,
        classColor: cls.color,
        classDisplayLabel: cls.displayLabel,
        tag,
        sectionIndex,
        startOffset: start,
        endOffset: end,
        originalText: text,
      };
      setCurrentAnnotations((prev) => [...prev, newAnn]);
      setAnnotationStatuses((prev) => {
        const next = new Map(prev);
        next.set(newAnn.id, AnnotationQAStatus.QA_ADDED);
        return next;
      });
      setModifications((prev) => [
        ...prev,
        { type: "added", annotationId: newAnn.id, description: `Added ${cls.name}: "${text}"` },
      ]);
      setIsDirty(true);
    setDirtyTick((t) => t + 1);
      setDirtyTick((t) => t + 1);
      window.getSelection()?.removeAllRanges();
    },
    [],
  );

  const reassignTag = useCallback((annotationId: string, newTag: string) => {
    setCurrentAnnotations((prev) =>
      prev.map((ann) => {
        if (ann.id !== annotationId) return ann;
        return { ...ann, tag: newTag };
      }),
    );
    setAnnotationStatuses((prev) => {
      const next = new Map(prev);
      if (prev.get(annotationId) !== AnnotationQAStatus.QA_ADDED) {
        next.set(annotationId, AnnotationQAStatus.OK);
      }
      return next;
    });
    setModifications((prev) => [
      ...prev,
      { type: "modified", annotationId, description: `Reassigned tag to ${newTag}` },
    ]);
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const getExistingTagsForClass = useCallback(
    (className: string, excludeTag: string): { tag: string; sampleText: string }[] => {
      const tagMap = new Map<string, string>();
      for (const ann of currentAnnotations) {
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
    [currentAnnotations],
  );

  const toggleEditMode = useCallback(() => {
    setEditModeEnabled((prev) => !prev);
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const setAnnotationNote = useCallback((id: string, note: string) => {
    setAnnotationNotes((prev) => {
      const next = new Map(prev);
      next.set(id, note);
      return next;
    });
    setIsDirty(true);
    setDirtyTick((t) => t + 1);
  }, []);

  const getModificationSummary = useCallback(() => {
    const modified = modifications.filter((m) => m.type === "modified").length;
    const added = modifications.filter((m) => m.type === "added").length;
    const deleted = modifications.filter((m) => m.type === "deleted").length;
    return { modified, added, deleted };
  }, [modifications]);

  const hasModifications = modifications.length > 0;

  const discard = useCallback(async (reason: string) => {
    await discardMutation.mutateAsync({
      jobId,
      reason,
      expectedStatus: job?.status,
    });
  }, [jobId, job?.status, discardMutation]);

  // Build draft payload (shared between silent + manual save)
  const buildDraftPayload = useCallback(() => {
    const statuses: Record<string, string> = {};
    annotationStatuses.forEach((s, id) => {
      statuses[id] = s;
    });
    const notes: Record<string, string> = {};
    annotationNotes.forEach((note, id) => {
      if (note) notes[id] = note;
    });
    return {
      annotations: currentAnnotations,
      statuses,
      notes,
      modifications,
      editModeEnabled,
    };
  }, [currentAnnotations, annotationStatuses, annotationNotes, modifications, editModeEnabled]);

  // Ref-stable silent save for autosave (no toast)
  const saveDraftSilentRef = useRef<(() => Promise<void>) | undefined>(undefined);
  saveDraftSilentRef.current = async () => {
    await saveDraftMutation.mutateAsync({ jobId, data: buildDraftPayload() });
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
    enabled: job?.status === JobStatus.QA_IN_PROGRESS,
  });

  // Manual save: cancel autosave, save, show toast
  const saveDraft = useCallback(async () => {
    cancelPendingAutosave();
    await saveDraftMutation.mutateAsync({ jobId, data: buildDraftPayload() });
    setIsDirty(false);
    toast.success("QA draft saved");
  }, [jobId, buildDraftPayload, saveDraftMutation, cancelPendingAutosave]);

  const accept = useCallback(
    async (comments: string) => {
      await acceptMutation.mutateAsync({
        jobId,
        comments,
        modifications,
        modifiedAnnotations: hasModifications ? currentAnnotations : null,
      });
    },
    [jobId, modifications, hasModifications, currentAnnotations, acceptMutation],
  );

  const reject = useCallback(
    async (comments: string) => {
      const notes: Record<string, string> = {};
      annotationNotes.forEach((note, id) => {
        if (note) notes[id] = note;
      });
      await rejectMutation.mutateAsync({
        jobId,
        comments,
        annotationNotes: notes,
      });
    },
    [jobId, annotationNotes, rejectMutation],
  );

  return {
    job,
    sections,
    rawContent,
    annotatorInfo: job?.annotatorInfo ?? null,
    isLoading: jobLoading || contentLoading || draftLoading,
    blindReviewEnabled,
    originalAnnotations,
    currentAnnotations,
    annotationStatuses,
    annotationNotes,
    modifications,
    editModeEnabled,
    activeRightTab,
    selectedAnnotationId,
    setSelectedAnnotationId,
    markOK,
    flagAnnotation,
    editAnnotation,
    deleteAnnotation,
    addAnnotation,
    reassignTag,
    getExistingTagsForClass,
    toggleEditMode,
    setAnnotationNote,
    getModificationSummary,
    hasModifications,
    saveDraft,
    isSaving: saveDraftMutation.isPending,
    isDirty,
    autosaveStatus,
    accept,
    reject,
    discard,
    isAccepting: acceptMutation.isPending,
    isRejecting: rejectMutation.isPending,
    isDiscarding: discardMutation.isPending,
    setActiveRightTab,
  };
}
