import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface SameValueLinkingDialogProps {
  open: boolean;
  text: string;
  existingTag: string;
  newTag: string;
  similarText?: string;
  onUseExisting: () => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

export function SameValueLinkingDialog({
  open,
  text,
  existingTag,
  newTag,
  similarText,
  onUseExisting,
  onCreateNew,
  onCancel,
}: SameValueLinkingDialogProps) {
  const isFuzzy = !!similarText;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {isFuzzy ? "Similar Value Detected" : "Same Value Detected"}
          </DialogTitle>
          <DialogDescription className="pr-6">
            {isFuzzy ? (
              <>
                The text{" "}
                <span className="font-mono font-medium text-foreground break-all">
                  &ldquo;{text}&rdquo;
                </span>{" "}
                is similar to{" "}
                <span className="font-mono font-medium text-foreground break-all">
                  &ldquo;{similarText}&rdquo;
                </span>{" "}
                (tagged as{" "}
                <span className="font-mono font-medium text-foreground break-all">
                  {existingTag}
                </span>
                ). Would you like to use the same tag?
              </>
            ) : (
              <>
                The text{" "}
                <span className="font-mono font-medium text-foreground break-all">
                  &ldquo;{text}&rdquo;
                </span>{" "}
                was previously tagged as{" "}
                <span className="font-mono font-medium text-foreground break-all">
                  {existingTag}
                </span>
                . Would you like to reuse the same tag or create a new one?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={onCreateNew}>
            New Tag ({newTag})
          </Button>
          <Button onClick={onUseExisting}>
            Use Existing ({existingTag})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
