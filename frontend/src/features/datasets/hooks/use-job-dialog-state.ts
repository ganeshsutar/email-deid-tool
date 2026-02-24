import { useCallback, useState } from "react";
import type { Job } from "@/types/models";
import type { AnnotationVersionSummary } from "@/features/version-history/api/history-mapper";

interface JobDialogState {
  dialogJobId: string | null;
  dialogTab: string;
  dialogJobSnapshot: Job | null;
  detailViewOpen: boolean;
  detailVersion: AnnotationVersionSummary | null;
}

const INITIAL_STATE: JobDialogState = {
  dialogJobId: null,
  dialogTab: "email",
  dialogJobSnapshot: null,
  detailViewOpen: false,
  detailVersion: null,
};

export function useJobDialogState(jobs: Job[]) {
  const [state, setState] = useState<JobDialogState>(INITIAL_STATE);

  const openForJob = useCallback(
    (jobId: string) => {
      const snapshot = jobs.find((j) => j.id === jobId) ?? null;
      setState((s) => ({
        ...s,
        dialogJobId: jobId,
        dialogTab: "email",
        dialogJobSnapshot: snapshot,
      }));
    },
    [jobs],
  );

  const openForHistory = useCallback(
    (jobId: string) => {
      const snapshot = jobs.find((j) => j.id === jobId) ?? null;
      setState((s) => ({
        ...s,
        dialogJobId: jobId,
        dialogTab: "history",
        dialogJobSnapshot: snapshot,
      }));
    },
    [jobs],
  );

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const setDetailVersion = useCallback((version: AnnotationVersionSummary | null) => {
    setState((s) => ({
      ...s,
      detailVersion: version,
      detailViewOpen: !!version,
    }));
  }, []);

  const setDetailViewOpen = useCallback((open: boolean) => {
    setState((s) => ({
      ...s,
      detailViewOpen: open,
    }));
  }, []);

  const setDialogTab = useCallback((tab: string) => {
    setState((s) => ({ ...s, dialogTab: tab }));
  }, []);

  // Resolve dialogJob from current page jobs, falling back to snapshot
  const dialogJob = state.dialogJobId
    ? jobs.find((j) => j.id === state.dialogJobId) ?? state.dialogJobSnapshot
    : null;

  return {
    dialogJobId: state.dialogJobId,
    dialogTab: state.dialogTab,
    dialogJob,
    detailViewOpen: state.detailViewOpen,
    detailVersion: state.detailVersion,
    openForJob,
    openForHistory,
    close,
    setDetailVersion,
    setDetailViewOpen,
    setDialogTab,
  };
}
