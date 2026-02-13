import { useCallback, useEffect, useRef, useState } from "react";

export const AutosaveStatus = {
  IDLE: "IDLE",
  PENDING: "PENDING",
  SAVING: "SAVING",
  SAVED: "SAVED",
  ERROR: "ERROR",
} as const;
export type AutosaveStatus = (typeof AutosaveStatus)[keyof typeof AutosaveStatus];

interface UseAutosaveOptions {
  saveFn: () => Promise<void>;
  isDirty: boolean;
  isSaving: boolean;
  dirtyTick: number;
  debounceMs?: number;
  enabled?: boolean;
}

export function useAutosave({
  saveFn,
  isDirty,
  isSaving,
  dirtyTick,
  debounceMs = 3000,
  enabled = true,
}: UseAutosaveOptions) {
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>(AutosaveStatus.IDLE);

  // Refs to avoid stale closures in setTimeout / event callbacks
  const saveFnRef = useRef(saveFn);
  const isDirtyRef = useRef(isDirty);
  const isSavingRef = useRef(isSaving);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  saveFnRef.current = saveFn;
  isDirtyRef.current = isDirty;
  isSavingRef.current = isSaving;

  // Cancel pending debounce (exposed for manual save)
  const cancelPendingAutosave = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = undefined;
    }
    // If we were in PENDING, go back to IDLE (manual save will handle it)
    setAutosaveStatus((prev) =>
      prev === AutosaveStatus.PENDING ? AutosaveStatus.IDLE : prev,
    );
  }, []);

  // Debounce effect: triggered by dirtyTick changes
  useEffect(() => {
    if (!enabled || dirtyTick === 0) return;

    setAutosaveStatus(AutosaveStatus.PENDING);

    // Clear any previous debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      debounceTimerRef.current = undefined;

      // Don't save if not dirty anymore or already saving
      if (!isDirtyRef.current || isSavingRef.current) {
        setAutosaveStatus(AutosaveStatus.IDLE);
        return;
      }

      setAutosaveStatus(AutosaveStatus.SAVING);
      try {
        await saveFnRef.current();
        setAutosaveStatus(AutosaveStatus.SAVED);
        // Fade back to IDLE after 2s
        savedTimerRef.current = setTimeout(() => {
          setAutosaveStatus(AutosaveStatus.IDLE);
        }, 2000);
      } catch {
        setAutosaveStatus(AutosaveStatus.ERROR);
      }
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = undefined;
      }
    };
  }, [dirtyTick, enabled, debounceMs]);

  // Clean up saved timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) {
        clearTimeout(savedTimerRef.current);
      }
    };
  }, []);

  // beforeunload: warn user about unsaved changes
  useEffect(() => {
    if (!enabled) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault();
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [enabled]);

  // Best-effort save on unmount if dirty
  useEffect(() => {
    return () => {
      if (isDirtyRef.current && !isSavingRef.current && enabled) {
        saveFnRef.current().catch(() => {});
      }
    };
  }, [enabled]);

  return { autosaveStatus, cancelPendingAutosave };
}
