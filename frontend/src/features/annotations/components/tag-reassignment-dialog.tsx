import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TagReassignmentDialogProps {
  open: boolean;
  currentTag: string;
  availableTags: { tag: string; sampleText: string }[];
  onSelect: (tag: string) => void;
  onClose: () => void;
}

export function TagReassignmentDialog({
  open,
  currentTag,
  availableTags,
  onSelect,
  onClose,
}: TagReassignmentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link to Existing Tag</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Current tag:{" "}
          <span className="font-mono font-medium text-foreground">
            {currentTag}
          </span>
        </p>
        <div className="max-h-64 overflow-y-auto space-y-1">
          {availableTags.map(({ tag, sampleText }) => (
            <button
              key={tag}
              onClick={() => onSelect(tag)}
              className="w-full flex items-center gap-3 rounded-md border px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
            >
              <span className="font-mono font-medium shrink-0">{tag}</span>
              <span className="text-muted-foreground truncate">
                &ldquo;{sampleText}&rdquo;
              </span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
