import { useCallback, useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FileDropZoneProps {
  file: File | null;
  onFileSelect: (file: File) => void;
  onFileRemove: () => void;
  disabled?: boolean;
  maxSizeMB?: number;
}

export function FileDropZone({
  file,
  onFileSelect,
  onFileRemove,
  disabled = false,
  maxSizeMB = 500,
}: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxSizeBytes = maxSizeMB * 1024 * 1024;

  const validateAndSelect = useCallback(
    (selectedFile: File) => {
      if (!selectedFile.name.endsWith(".zip")) {
        setError("Only .zip files are accepted");
        return;
      }
      if (selectedFile.size > maxSizeBytes) {
        setError(`File exceeds maximum size of ${maxSizeMB}MB`);
        return;
      }
      setError(null);
      onFileSelect(selectedFile);
    },
    [maxSizeBytes, maxSizeMB, onFileSelect],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!disabled) setIsDragging(true);
    },
    [disabled],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;

      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) {
        validateAndSelect(droppedFile);
      }
    },
    [disabled, validateAndSelect],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (selectedFile) {
        validateAndSelect(selectedFile);
      }
    },
    [validateAndSelect],
  );

  const handleRemove = useCallback(() => {
    setError(null);
    onFileRemove();
  }, [onFileRemove]);

  if (file) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dashed p-4" data-testid="file-drop-zone">
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleRemove}
          disabled={disabled}
          aria-label="Remove file"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="file-drop-zone"
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">
          Drag & drop a .zip file here, or click to browse
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Only .zip archives containing .eml files (max {maxSizeMB}MB)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".zip"
          className="hidden"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>
      {error && (
        <p className="mt-2 text-sm text-destructive" data-testid="file-drop-error">{error}</p>
      )}
    </div>
  );
}
