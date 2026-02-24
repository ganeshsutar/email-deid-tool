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
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useChangePassword } from "@/features/auth/api/change-password";

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: ChangePasswordDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <ChangePasswordDialogContent onOpenChange={onOpenChange} />
      )}
    </Dialog>
  );
}

function ChangePasswordDialogContent({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const changePassword = useChangePassword();

  const passwordsMatch = newPassword === confirmPassword;
  const isDisabled =
    !newPassword ||
    !confirmPassword ||
    !passwordsMatch ||
    changePassword.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!passwordsMatch) {
      setError("Passwords do not match.");
      return;
    }

    try {
      await changePassword.mutateAsync({ new_password: newPassword });
      onOpenChange(false);
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "response" in err &&
        (err as { response?: { data?: { new_password?: string[] } } }).response
          ?.data?.new_password
      ) {
        setError(
          (
            err as {
              response: { data: { new_password: string[] } };
            }
          ).response.data.new_password[0],
        );
      } else {
        setError("An unexpected error occurred. Please try again.");
      }
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Change Password</DialogTitle>
        <DialogDescription>
          Enter a new password for your account.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="dialog-new-password">New Password</Label>
          <PasswordInput
            id="dialog-new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dialog-confirm-password">Confirm Password</Label>
          <PasswordInput
            id="dialog-confirm-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
          {confirmPassword && !passwordsMatch && (
            <p className="text-sm text-destructive">
              Passwords do not match.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isDisabled}>
            {changePassword.isPending ? "Changing password..." : "Change Password"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
