import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface EditModeControlsProps {
  enabled: boolean;
  onToggle: () => void;
  modificationCount: number;
}

export function EditModeControls({
  enabled,
  onToggle,
  modificationCount,
}: EditModeControlsProps) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="edit-mode"
        checked={enabled}
        onCheckedChange={onToggle}
        data-testid="edit-mode-toggle"
      />
      <Label htmlFor="edit-mode" className="text-sm cursor-pointer">
        Edit Mode: {enabled ? "ON" : "OFF"}
      </Label>
      {modificationCount > 0 && (
        <Badge variant="secondary" className="text-xs" data-testid="modification-count-badge">
          {modificationCount} change{modificationCount !== 1 ? "s" : ""}
        </Badge>
      )}
    </div>
  );
}
