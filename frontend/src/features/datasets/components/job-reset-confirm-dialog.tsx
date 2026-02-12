import { RotateCcw } from "lucide-react";
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
  useResetJob,
  useResetJobs,
} from "@/features/datasets/api/reset-jobs";

interface JobResetConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  datasetId: string;
  /** Single reset mode */
  jobId?: string | null;
  jobFileName?: string;
  jobStatus?: string;
  /** Bulk reset mode */
  jobIds?: string[];
  onComplete: () => void;
}

export function JobResetConfirmDialog({
  open,
  onOpenChange,
  datasetId,
  jobId,
  jobFileName,
  jobStatus,
  jobIds,
  onComplete,
}: JobResetConfirmDialogProps) {
  const resetJob = useResetJob(datasetId);
  const resetJobs = useResetJobs(datasetId);

  const isBulk = !jobId && !!jobIds && jobIds.length > 0;
  const count = isBulk ? jobIds!.length : 1;
  const isPending = resetJob.isPending || resetJobs.isPending;

  async function handleReset() {
    try {
      if (isBulk) {
        await resetJobs.mutateAsync({ jobIds: jobIds! });
      } else if (jobId) {
        await resetJob.mutateAsync({
          jobId,
          expectedStatus: jobStatus,
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
      <AlertDialogContent data-testid="job-reset-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? `Reset ${count} Jobs to Uploaded` : "Reset Job to Uploaded"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? (
              <>
                This will reset <strong>{count}</strong> selected job(s) back to
                Uploaded status. Assignments will be cleared and drafts removed.
              </>
            ) : (
              <>
                This will reset{" "}
                <strong>{jobFileName ?? "this job"}</strong> back to Uploaded
                status. Assignments will be cleared and drafts removed.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex items-start gap-2 rounded-md border border-blue-500/50 bg-blue-500/10 p-3 text-sm text-blue-700 dark:text-blue-300">
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Annotation and QA review history will be preserved. Only
            assignments and draft data will be cleared.
          </span>
        </div>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="job-reset-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleReset}
            disabled={isPending}
            data-testid="job-reset-confirm"
          >
            {isPending
              ? "Resetting..."
              : isBulk
                ? `Reset ${count} Jobs`
                : "Reset to Uploaded"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
