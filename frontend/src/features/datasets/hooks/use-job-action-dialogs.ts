import { useCallback, useState } from "react";

interface ActionDialogState {
  type: "delete" | "reset" | null;
  jobId: string | null;
  fileName: string;
  status: string;
  isBulk: boolean;
}

const INITIAL_STATE: ActionDialogState = {
  type: null,
  jobId: null,
  fileName: "",
  status: "",
  isBulk: false,
};

export function useJobActionDialogs() {
  const [state, setState] = useState<ActionDialogState>(INITIAL_STATE);

  const openDelete = useCallback((jobId: string, fileName: string) => {
    setState({ type: "delete", jobId, fileName, status: "", isBulk: false });
  }, []);

  const openBulkDelete = useCallback(() => {
    setState({ type: "delete", jobId: null, fileName: "", status: "", isBulk: true });
  }, []);

  const openReset = useCallback((jobId: string, fileName: string, jobStatus: string) => {
    setState({ type: "reset", jobId, fileName, status: jobStatus, isBulk: false });
  }, []);

  const openBulkReset = useCallback(() => {
    setState({ type: "reset", jobId: null, fileName: "", status: "", isBulk: true });
  }, []);

  const close = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    deleteDialogOpen: state.type === "delete",
    resetDialogOpen: state.type === "reset",
    deleteJobId: state.type === "delete" ? state.jobId : null,
    deleteJobFileName: state.type === "delete" ? state.fileName : "",
    deleteIsBulk: state.type === "delete" && state.isBulk,
    resetJobId: state.type === "reset" ? state.jobId : null,
    resetJobFileName: state.type === "reset" ? state.fileName : "",
    resetJobStatus: state.type === "reset" ? state.status : "",
    resetIsBulk: state.type === "reset" && state.isBulk,
    openDelete,
    openBulkDelete,
    openReset,
    openBulkReset,
    close,
  };
}
