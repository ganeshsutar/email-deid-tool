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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useChangeUserPassword } from "@/features/users/api/change-user-password";
import type { User } from "@/types/models";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  user,
}: ChangePasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && user && (
        <ChangePasswordDialogContent
          user={user}
          onOpenChange={onOpenChange}
        />
      )}
    </Dialog>
  );
}

function ChangePasswordDialogContent({
  user,
  onOpenChange,
}: {
  user: User;
  onOpenChange: (open: boolean) => void;
}) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const changePassword = useChangeUserPassword();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      await changePassword.mutateAsync({
        id: user.id,
        newPassword: password,
      });
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
    <DialogContent data-testid="change-password-dialog">
      <DialogHeader>
        <DialogTitle>Reset Password</DialogTitle>
        <DialogDescription>
          Set a new password for {user.name}. They will be required to change it
          on next login.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="new-password">New Password</Label>
          <Input
            id="new-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter new password"
            autoComplete="new-password"
            data-testid="new-password-input"
          />
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!password || changePassword.isPending}
            data-testid="change-password-submit"
          >
            {changePassword.isPending ? "Saving..." : "Reset Password"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
