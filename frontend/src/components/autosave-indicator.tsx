import { Check, AlertCircle, Loader2 } from "lucide-react";
import { AutosaveStatus } from "@/hooks/use-autosave";

interface AutosaveIndicatorProps {
  status: AutosaveStatus;
}

export function AutosaveIndicator({ status }: AutosaveIndicatorProps) {
  if (status === AutosaveStatus.IDLE) return null;

  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      {status === AutosaveStatus.PENDING && "Unsaved changes"}
      {status === AutosaveStatus.SAVING && (
        <>
          <Loader2 className="h-3 w-3 animate-spin" />
          Saving...
        </>
      )}
      {status === AutosaveStatus.SAVED && (
        <>
          <Check className="h-3 w-3 text-green-600" />
          <span className="text-green-600">Saved</span>
        </>
      )}
      {status === AutosaveStatus.ERROR && (
        <>
          <AlertCircle className="h-3 w-3 text-destructive" />
          <span className="text-destructive">Save failed</span>
        </>
      )}
    </span>
  );
}
