import { useState, useCallback } from "react";
import { Copy, Check } from "lucide-react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useCreateUser } from "@/features/users/api/create-user";
import { useUpdateUser } from "@/features/users/api/update-user";
import type { User } from "@/types/models";
import { UserRole, UserStatus } from "@/types/enums";

interface UserFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  onDeactivate: (user: User) => void;
  onActivate: (user: User) => void;
  onChangePassword: (user: User) => void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  onDeactivate,
  onActivate,
  onChangePassword,
}: UserFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <UserFormDialogContent
          user={user}
          onOpenChange={onOpenChange}
          onDeactivate={onDeactivate}
          onActivate={onActivate}
          onChangePassword={onChangePassword}
        />
      )}
    </Dialog>
  );
}

function UserFormDialogContent({
  user,
  onOpenChange,
  onDeactivate,
  onActivate,
  onChangePassword,
}: Omit<UserFormDialogProps, "open">) {
  const isEdit = !!user;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<string>(user?.role ?? UserRole.ANNOTATOR);
  const [error, setError] = useState("");
  const [tempPassword, setTempPassword] = useState("");

  const isLoading = createUser.isPending || updateUser.isPending;
  const isDisabled = !name || (!isEdit && !email) || isLoading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    try {
      if (isEdit) {
        await updateUser.mutateAsync({ id: user.id, name, role });
        onOpenChange(false);
      } else {
        const result = await createUser.mutateAsync({ name, email, role });
        setTempPassword(result.tempPassword);
      }
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

  if (tempPassword) {
    return (
      <DialogContent data-testid="user-form-dialog">
        <DialogHeader>
          <DialogTitle>User Created</DialogTitle>
          <DialogDescription>
            Share this temporary password with the user. They will be asked to
            change it on first login.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label>Temporary Password</Label>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm" data-testid="temp-password-display">
              {tempPassword}
            </code>
            <CopyButton text={tempPassword} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent data-testid="user-form-dialog">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit User" : "Create User"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update user details."
            : "Create a new user account. A temporary password will be generated."}
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <Alert variant="destructive" data-testid="user-form-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="space-y-2">
          <Label htmlFor="user-name">Name</Label>
          <Input
            id="user-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            data-testid="user-name-input"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-email">Email</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            disabled={isEdit}
            data-testid="user-email-input"
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <RadioGroup value={role} onValueChange={setRole} data-testid="user-role-select">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={UserRole.ADMIN} id="role-admin" />
              <Label htmlFor="role-admin">Admin</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value={UserRole.ANNOTATOR}
                id="role-annotator"
              />
              <Label htmlFor="role-annotator">Annotator</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value={UserRole.QA} id="role-qa" />
              <Label htmlFor="role-qa">QA</Label>
            </div>
          </RadioGroup>
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <div className="flex gap-2">
            {isEdit && (
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={() => onChangePassword(user)}
                data-testid="user-change-password-button"
              >
                Reset Password
              </Button>
            )}
            {isEdit && user.status === UserStatus.ACTIVE && (
              <Button
                type="button"
                variant="link"
                className="text-destructive px-0"
                onClick={() => onDeactivate(user)}
                data-testid="user-deactivate-button"
              >
                Deactivate User
              </Button>
            )}
            {isEdit && user.status === UserStatus.INACTIVE && (
              <Button
                type="button"
                variant="link"
                className="px-0"
                onClick={() => onActivate(user)}
                data-testid="user-activate-button"
              >
                Activate User
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              data-testid="user-form-cancel"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isDisabled} data-testid="user-form-submit">
              {isLoading
                ? "Saving..."
                : isEdit
                  ? "Save Changes"
                  : "Create User"}
            </Button>
          </div>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="shrink-0"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
    </Button>
  );
}
