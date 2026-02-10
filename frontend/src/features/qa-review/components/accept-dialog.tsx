import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface AcceptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  modificationSummary: { modified: number; added: number; deleted: number };
  hasModifications: boolean;
  isSubmitting: boolean;
  onConfirm: (comments: string) => void;
}

export function AcceptDialog({
  open,
  onOpenChange,
  modificationSummary,
  hasModifications,
  isSubmitting,
  onConfirm,
}: AcceptDialogProps) {
  const [comments, setComments] = useState("");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="accept-dialog">
        <DialogHeader>
          <DialogTitle>Accept Annotations?</DialogTitle>
          <DialogDescription data-testid="modification-summary">
            {hasModifications ? (
              <>
                You have made modifications:{" "}
                {modificationSummary.modified > 0 &&
                  `${modificationSummary.modified} modified, `}
                {modificationSummary.added > 0 &&
                  `${modificationSummary.added} added, `}
                {modificationSummary.deleted > 0 &&
                  `${modificationSummary.deleted} deleted`}
                . A new QA annotation version will be created.
              </>
            ) : (
              <>Accept the annotations as-is and mark this job as delivered.</>
            )}
          </DialogDescription>
        </DialogHeader>
        <Textarea
          placeholder="Optional comments..."
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="accept-cancel">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(comments)}
            disabled={isSubmitting}
            data-testid="accept-confirm"
          >
            {isSubmitting ? "Accepting..." : "Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
