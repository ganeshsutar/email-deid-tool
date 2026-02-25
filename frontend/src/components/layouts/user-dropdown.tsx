import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { LogOut, KeyRound, Paintbrush, UserRoundCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUser, useAuth } from "@/lib/auth";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarChangeDialog } from "@/components/avatar-change-dialog";
import { ChangePasswordDialog } from "@/features/auth/components/change-password-dialog";
import { AppearanceSheet } from "@/components/appearance-sheet";

export function UserDropdown() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);
  const [changePasswordDialogOpen, setChangePasswordDialogOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2 rounded-md p-1.5 hover:bg-accent" data-testid="user-menu-trigger">
            <UserAvatar
              name={user.name}
              email={user.email}
              avatarConfig={user.avatarConfig}
            />
            <span className="text-sm font-medium hidden sm:inline-block">
              {user.name}
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAppearanceOpen(true)}>
            <Paintbrush className="mr-2 h-4 w-4" />
            Appearance
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAvatarDialogOpen(true)}>
            <UserRoundCog className="mr-2 h-4 w-4" />
            Change Avatar
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setChangePasswordDialogOpen(true)}>
            <KeyRound className="mr-2 h-4 w-4" />
            Change Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={handleLogout} data-testid="sign-out-button">
            <LogOut className="mr-2 h-4 w-4" />
            Log Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <AppearanceSheet open={appearanceOpen} onOpenChange={setAppearanceOpen} />
      <AvatarChangeDialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen} />
      <ChangePasswordDialog open={changePasswordDialogOpen} onOpenChange={setChangePasswordDialogOpen} />
    </>
  );
}
