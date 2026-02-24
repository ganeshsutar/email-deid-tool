import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useDeleteDataset } from "@/features/datasets/api/delete-dataset";

interface DatasetDeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Single deletion mode */
  datasetId?: string | null;
  datasetName?: string;
  fileCount?: number;
  /** Bulk deletion mode */
  datasets?: Array<{ id: string; name: string; fileCount: number }>;
  onComplete: () => void;
}

export function DatasetDeleteConfirmDialog({
  open,
  onOpenChange,
  datasetId,
  datasetName = "",
  fileCount = 0,
  datasets,
  onComplete,
}: DatasetDeleteConfirmDialogProps) {
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const deleteDataset = useDeleteDataset();

  const isBulk = !!datasets && datasets.length > 0;
  const confirmTarget = isBulk ? "DELETE" : datasetName;
  const canConfirm = confirmText === confirmTarget;

  async function handleDelete() {
    if (!canConfirm) return;

    if (isBulk) {
      setIsDeleting(true);
      let successCount = 0;
      for (const ds of datasets!) {
        try {
          await deleteDataset.mutateAsync(ds.id);
          successCount++;
        } catch {
          // Continue deleting remaining datasets
        }
      }
      setIsDeleting(false);
      toast.success(`Deleted ${successCount} of ${datasets!.length} datasets`);
      setConfirmText("");
      onOpenChange(false);
      onComplete();
    } else {
      if (!datasetId) return;
      try {
        await deleteDataset.mutateAsync(datasetId);
        setConfirmText("");
        onOpenChange(false);
        onComplete();
      } catch {
        // Error handled by mutation
      }
    }
  }

  const totalFiles = isBulk
    ? datasets!.reduce((sum, d) => sum + d.fileCount, 0)
    : fileCount;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(val) => {
        if (!val) setConfirmText("");
        onOpenChange(val);
      }}
    >
      <AlertDialogContent data-testid="dataset-delete-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isBulk ? `Delete ${datasets!.length} Datasets` : "Delete Dataset"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isBulk ? (
              <>
                This will permanently delete <strong>{datasets!.length}</strong>{" "}
                datasets and all <strong>{totalFiles}</strong> associated jobs.
                This action cannot be undone.
              </>
            ) : (
              <>
                This will permanently delete <strong>{datasetName}</strong> and all{" "}
                <strong>{fileCount}</strong> associated jobs. This action cannot be
                undone.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isBulk && (
          <ul className="max-h-32 overflow-y-auto rounded-md border bg-muted/50 p-2 text-sm">
            {datasets!.map((d) => (
              <li key={d.id} className="truncate py-0.5">
                {d.name} ({d.fileCount} files)
              </li>
            ))}
          </ul>
        )}
        <div className="space-y-2">
          <Label>
            {isBulk ? (
              <>
                Type <strong>DELETE</strong> to confirm
              </>
            ) : (
              <>
                Type <strong>{datasetName}</strong> to confirm
              </>
            )}
          </Label>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={isBulk ? "DELETE" : "Dataset name"}
            data-testid="dataset-delete-confirm-input"
          />
        </div>
        <AlertDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="dataset-delete-cancel">
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={!canConfirm || deleteDataset.isPending || isDeleting}
            data-testid="dataset-delete-confirm"
          >
            {deleteDataset.isPending || isDeleting
              ? "Deleting..."
              : isBulk
                ? `Delete ${datasets!.length} Datasets`
                : "Delete Dataset"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
