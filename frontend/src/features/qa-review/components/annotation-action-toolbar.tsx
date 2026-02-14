import { useEffect, useState } from "react";
import { Check, Flag, Link2, Minus, Pencil, Plus, Trash2 } from "lucide-react";
import type { WorkspaceAnnotation } from "@/types/models";
import type { AnnotationQAStatus } from "@/types/enums";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface AnnotationActionToolbarProps {
  annotation: WorkspaceAnnotation;
  status: AnnotationQAStatus;
  position: { x: number; y: number };
  editMode: boolean;
  onMarkOK: () => void;
  onFlag: () => void;
  onEdit: () => void;
  onChangeTag?: () => void;
  hasOtherTags?: boolean;
  onDelete: () => void;
  onClose: () => void;
  onChangeTagIndex?: (newIndex: number) => void;
}

export function AnnotationActionToolbar({
  annotation,
  status,
  position,
  editMode,
  onMarkOK,
  onFlag,
  onEdit,
  onChangeTag,
  hasOtherTags,
  onDelete,
  onClose,
  onChangeTagIndex,
}: AnnotationActionToolbarProps) {
  const tagMatch = annotation.tag.match(/\[(\w+)_(\d+)\]/);
  const currentIndex = tagMatch ? parseInt(tagMatch[2], 10) : 1;
  const [indexInput, setIndexInput] = useState(String(currentIndex));

  // Sync local input when annotation tag changes externally
  useEffect(() => {
    const m = annotation.tag.match(/\[(\w+)_(\d+)\]/);
    if (m) setIndexInput(m[2]);
  }, [annotation.tag]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  function applyIndex(value: string) {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 1 && onChangeTagIndex) {
      onChangeTagIndex(parsed);
      setIndexInput(String(parsed));
    } else {
      setIndexInput(String(currentIndex));
    }
  }

  // Clamp position to viewport
  const toolbarWidth = 288;
  const toolbarMaxHeight = 170;
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(Math.max(8, position.x - toolbarWidth / 2), window.innerWidth - toolbarWidth - 8),
    top: Math.min(position.y, window.innerHeight - toolbarMaxHeight - 8),
    zIndex: 50,
  };

  return (
    <>
      {/* Backdrop for outside-click dismiss */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      {/* Toolbar */}
      <div
        style={style}
        className="w-72 rounded-lg border bg-popover text-popover-foreground shadow-lg ring-1 ring-border/50 p-3 space-y-2"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div
              className="h-3 w-3 rounded"
              style={{ backgroundColor: annotation.classColor }}
            />
            <span className="font-medium text-sm">
              {annotation.classDisplayLabel}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {annotation.tag}
            </span>
          </div>
          {editMode && onChangeTagIndex && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Index:</span>
              <Input
                type="number"
                min={1}
                value={indexInput}
                onChange={(e) => setIndexInput(e.target.value)}
                onBlur={() => applyIndex(indexInput)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyIndex(indexInput);
                }}
                className="w-14 h-6 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <div className="flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={currentIndex <= 1}
                  onClick={() => onChangeTagIndex(currentIndex - 1)}
                  title="Decrease index"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => onChangeTagIndex(currentIndex + 1)}
                  title="Increase index"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground font-mono truncate">
            &ldquo;{annotation.originalText}&rdquo;
          </p>
          <p className="text-xs text-muted-foreground">
            Status: <span className="font-medium">{status}</span>
          </p>
        </div>
        <div className="flex items-center gap-1 border-t pt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
            disabled={status === "OK"}
            onClick={() => { onMarkOK(); onClose(); }}
            title="Mark OK"
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
            disabled={status === "FLAGGED"}
            onClick={() => { onFlag(); onClose(); }}
            title="Flag"
          >
            <Flag className="h-3.5 w-3.5" />
          </Button>
          {editMode && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => { onEdit(); onClose(); }}
                title="Change class"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              {hasOtherTags && onChangeTag && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => { onChangeTag(); onClose(); }}
                  title="Link to existing tag"
                >
                  <Link2 className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => { onDelete(); onClose(); }}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
