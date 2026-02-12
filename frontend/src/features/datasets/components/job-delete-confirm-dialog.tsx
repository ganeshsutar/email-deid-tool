import { AlertTriangle } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  useDeleteJob,
  useDeleteJobs,
} from "@/features/datasets/api/delete-jobs";

interface JobDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetId: string;
  /** Single deletion mode */
  jobId?: string | null;
  jobFileName?: string;
  /** Bulk deletion mode */
  jobIds?: string[];
  hasInProgress: boolean;
  onComplete: () => void;
}

export function JobDeleteConfirmDialog({
  open,
  onOpenChange,
  datasetId,
  jobId,
  jobFileName,
  jobIds,
  hasInProgress,
  onComplete,
}: JobDeleteConfirmDialogProps) {
  const deleteJob = useDeleteJob(datasetId);
  const deleteJobs = useDeleteJobs(datasetId);

  const isBulk = !jobId && !!jobIds && jobIds.length > 0;
  const count = isBulk ? jobIds!.length : 1;
  const isPending = deleteJob.isPending || deleteJobs.isPending;

  async function handleDelete() {
    try {
      if (isBulk) {
        await deleteJobs.mutateAsync({
          jobIds: jobIds!,
          force: hasInProgress,
        });
      } else if (jobId) {
        await deleteJob.mutateAsync({
          jobId,
          force: hasInProgress,
        });
      }
      onOpenChange(false);
      onComplete();
    } catch {
      // Error handled by mutation
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="job-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? `Delete ${count} Jobs` : "Delete Job"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? (
              <>
                This will permanently delete <strong>{count}</strong> selected
                job(s) and all associated annotations. This action cannot be
                undone.
              </>
            ) : (
              <>
                This will permanently delete{" "}
                <strong>{jobFileName ?? "this job"}</strong> and all associated
                annotations. This action cannot be undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {hasInProgress && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              {isBulk
                ? "Some of the selected jobs are currently in progress. Deleting them will discard any unsaved work."
                : "This job is currently in progress. Deleting it will discard any unsaved work."}
            </span>
          </div>
        )}
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="job-delete-cancel"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
            data-testid="job-delete-confirm"
          >
            {isPending
              ? "Deleting..."
              : isBulk
                ? `Delete ${count} Jobs`
                : "Delete Job"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
