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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateAnnotationClass } from "@/features/annotation-classes/api/create-annotation-class";
import { useUpdateAnnotationClass } from "@/features/annotation-classes/api/update-annotation-class";
import { useRenameAnnotationClass } from "@/features/annotation-classes/api/rename-annotation-class";
import type { AnnotationClass } from "@/types/models";

const PRESET_COLORS = [
  "#E53E3E",
  "#DD6B20",
  "#D69E2E",
  "#38A169",
  "#3182CE",
  "#805AD5",
  "#D53F8C",
  "#718096",
];

function labelToName(label: string): string {
  return label
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

interface AnnotationClassFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  annotationClass: AnnotationClass | null;
}

export function AnnotationClassFormDialog({
  open,
  onOpenChange,
  annotationClass,
}: AnnotationClassFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AnnotationClassFormContent
          annotationClass={annotationClass}
          onOpenChange={onOpenChange}
        />
      )}
    </Dialog>
  );
}

function AnnotationClassFormContent({
  annotationClass,
  onOpenChange,
}: Omit<AnnotationClassFormDialogProps, "open">) {
  const isEdit = !!annotationClass;
  const createClass = useCreateAnnotationClass();
  const updateClass = useUpdateAnnotationClass();
  const renameClass = useRenameAnnotationClass();

  const [displayLabel, setDisplayLabel] = useState(
    annotationClass?.displayLabel ?? "",
  );
  const [name, setName] = useState(annotationClass?.name ?? "");
  const [color, setColor] = useState(
    annotationClass?.color ?? PRESET_COLORS[0],
  );
  const [customColor, setCustomColor] = useState("");
  const [description, setDescription] = useState(
    annotationClass?.description ?? "",
  );
  const [error, setError] = useState("");

  function handleLabelChange(value: string) {
    setDisplayLabel(value);
    if (!isEdit) {
      setName(labelToName(value));
    }
  }

  function handleColorSelect(c: string) {
    setColor(c);
    setCustomColor("");
  }

  function handleCustomColorChange(value: string) {
    setCustomColor(value);
    if (/^#[0-9a-fA-F]{6}$/.test(value)) {
      setColor(value);
    }
  }

  const nameChanged = isEdit && name !== (annotationClass?.name ?? "");
  const isLoading =
    createClass.isPending || updateClass.isPending || renameClass.isPending;
  const isDisabled = !displayLabel || !name || !color || isLoading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      if (isEdit) {
        if (nameChanged) {
          await renameClass.mutateAsync({
            id: annotationClass.id,
            name,
          });
        }
        await updateClass.mutateAsync({
          id: annotationClass.id,
          display_label: displayLabel,
          color,
          description,
        });
      } else {
        await createClass.mutateAsync({
          name,
          display_label: displayLabel,
          color,
          description,
        });
      }
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: Record<string, string[]> } }).response
          ?.data
          ? Object.values(
              (err as { response: { data: Record<string, string[]> } })
                .response.data,
            )
              .flat()
              .join(" ")
          : "An unexpected error occurred.";
      setError(message);
    }
  }

  return (
    <DialogContent className="max-w-md" data-testid="class-form-dialog">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit Annotation Class" : "Create Annotation Class"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update annotation class details."
            : "Define a new annotation class for labeling emails."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive" data-testid="class-form-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="display-label">Display Label</Label>
          <Input
            id="display-label"
            value={displayLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
            placeholder="e.g. First Name (Person)"
            autoFocus
            data-testid="class-label-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class-name">Name</Label>
          <Input
            id="class-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. first_name_person"
            className="font-mono"
            data-testid="class-name-input"
          />
          {name && (
            <p className="text-xs text-muted-foreground">
              Tag preview:{" "}
              <code className="rounded bg-muted px-1 py-0.5">
                [{name}_1]
              </code>
            </p>
          )}
          {nameChanged && (
            <Alert>
              <AlertDescription>
                Renaming will update all existing annotations and drafts using
                this class.
              </AlertDescription>
            </Alert>
          )}
        </div>
        <div className="space-y-2">
          <Label>Color</Label>
          <div className="flex flex-wrap gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                className={`h-8 w-8 rounded border-2 ${
                  color === c ? "border-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                onClick={() => handleColorSelect(c)}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="#RRGGBB"
              value={customColor || (PRESET_COLORS.includes(color) ? "" : color)}
              onChange={(e) => handleCustomColorChange(e.target.value)}
              className="max-w-[120px] font-mono"
              data-testid="class-color-input"
            />
            <span
              className="h-8 w-8 rounded border"
              style={{ backgroundColor: color }}
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={2}
            data-testid="class-description-input"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            data-testid="class-form-cancel"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isDisabled} data-testid="class-form-submit">
            {isLoading
              ? "Saving..."
              : isEdit
                ? "Save Changes"
                : "Create Class"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
