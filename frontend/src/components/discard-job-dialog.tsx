import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DiscardJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reasons: string[];
  isSubmitting: boolean;
  onConfirm: (reason: string) => void;
}

export function DiscardJobDialog({
  open,
  onOpenChange,
  reasons,
  isSubmitting,
  onConfirm,
}: DiscardJobDialogProps) {
  const [selectedReason, setSelectedReason] = useState("");

  function handleOpenChange(next: boolean) {
    if (!next) {
      setSelectedReason("");
    }
    onOpenChange(next);
  }

  function handleConfirm() {
    if (selectedReason) {
      onConfirm(selectedReason);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Discard This File?</DialogTitle>
          <DialogDescription>
            This file will be marked as discarded and removed from your queue.
            An admin can reset it later if needed. Please select a reason.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2">
          <Select value={selectedReason} onValueChange={setSelectedReason}>
            <SelectTrigger data-testid="discard-reason-select">
              <SelectValue placeholder="Select a reason..." />
            </SelectTrigger>
            <SelectContent>
              {reasons.map((reason) => (
                <SelectItem key={reason} value={reason}>
                  {reason}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!selectedReason || isSubmitting}
            data-testid="discard-confirm-button"
          >
            {isSubmitting ? "Discarding..." : "Discard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
