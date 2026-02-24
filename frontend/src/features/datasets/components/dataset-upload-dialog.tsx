import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useUploadDataset } from "@/features/datasets/api/upload-dataset";
import { useDatasetStatus } from "@/features/datasets/api/get-dataset-status";
import { DatasetStatus } from "@/types/enums";
import { FileDropZone } from "./file-drop-zone";

interface DatasetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DatasetUploadDialog({
  open,
  onOpenChange,
}: DatasetUploadDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <DatasetUploadDialogContent onOpenChange={onOpenChange} />}
    </Dialog>
  );
}

type UploadStage = "form" | "uploading" | "extracting" | "success" | "error";

function DatasetUploadDialogContent({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState<UploadStage>("form");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [fileCount, setFileCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [excludedCount, setExcludedCount] = useState(0);

  const uploadDataset = useUploadDataset();

  const isPolling =
    stage === "extracting" && datasetId !== null;

  const { data: statusData } = useDatasetStatus(datasetId ?? "", isPolling);

  // React to polling results
  useEffect(() => {
    if (statusData && stage === "extracting") {
      if (statusData.status === DatasetStatus.READY) {
        setStage("success");
        setFileCount(statusData.fileCount);
        setDuplicateCount(statusData.duplicateCount);
        setExcludedCount(statusData.excludedCount);
      } else if (statusData.status === DatasetStatus.FAILED) {
        setStage("error");
        setError(statusData.errorMessage || "Extraction failed.");
      }
    }
  }, [statusData, stage]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name) return;
    setError("");
    setStage("uploading");

    try {
      const result = await uploadDataset.mutateAsync({
        name,
        file,
        onUploadProgress: setUploadProgress,
      });
      setDatasetId(result.id);

      if (result.status === DatasetStatus.READY) {
        setStage("success");
        setFileCount(result.fileCount);
        setDuplicateCount(result.duplicateCount);
        setExcludedCount(result.excludedCount);
      } else if (result.status === DatasetStatus.FAILED) {
        setStage("error");
        setError(result.errorMessage || "Extraction failed.");
      } else {
        setStage("extracting");
      }
    } catch (err: unknown) {
      setStage("error");
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
          : "Upload failed. Please try again.";
      setError(message);
    }
  }

  function handleRetry() {
    setStage("form");
    setError("");
    setUploadProgress(0);
    setDatasetId(null);
  }

  if (stage === "success") {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Complete</DialogTitle>
          <DialogDescription>
            Dataset has been uploaded and extracted successfully.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
          <p className="text-sm text-muted-foreground">
            <strong>{fileCount}</strong> email files extracted from{" "}
            <strong>{name}</strong>
            {duplicateCount > 0 && (
              <>, <strong data-testid="dataset-duplicate-count">{duplicateCount}</strong> duplicate(s) skipped</>
            )}
            {excludedCount > 0 && (
              <>, <strong>{excludedCount}</strong> excluded by blocklist</>
            )}
          </p>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  if (stage === "error") {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Upload Failed</DialogTitle>
          <DialogDescription>
            There was a problem with the upload.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-3 py-4">
          <XCircle className="h-12 w-12 text-red-500" />
          <p className="text-sm text-destructive" data-testid="upload-error">{error}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handleRetry}>
            Try Again
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  const isProcessing = stage === "uploading" || stage === "extracting";

  return (
    <DialogContent data-testid="upload-dialog">
      <DialogHeader>
        <DialogTitle>Upload Dataset</DialogTitle>
        <DialogDescription>
          Upload a .zip file containing .eml email files.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="dataset-name">Dataset Name</Label>
          <Input
            id="dataset-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Batch 2024-01"
            disabled={isProcessing}
            data-testid="dataset-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label>File</Label>
          <FileDropZone
            file={file}
            onFileSelect={setFile}
            onFileRemove={() => setFile(null)}
            disabled={isProcessing}
          />
        </div>

        {stage === "uploading" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span>Uploading...</span>
              <span>{uploadProgress}%</span>
            </div>
            <Progress value={uploadProgress} />
          </div>
        )}

        {stage === "extracting" && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertDescription>
              Extracting email files... This may take a moment.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            data-testid="upload-cancel"
          >
            Cancel
          </Button>
          <Button type="submit" disabled={!name || !file || isProcessing} data-testid="upload-submit">
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Upload"
            )}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
