import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  ChevronsUpDown,
  LogOut,
  KeyRound,
  Settings,
  Sun,
  Moon,
  Monitor,
  Palette,
  Circle,
  Paintbrush,
  Radius,
  Check,
  UserRoundCog,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { useUser, useAuth } from "@/lib/auth";
import {
  useTheme,
  StylePreset,
  NeutralColor,
  BaseColor,
  ThemeMode,
  RADIUS_OPTIONS,
  NEUTRAL_SWATCH_COLORS,
  BASE_SWATCH_COLORS,
} from "@/lib/theme";
import { UserAvatar } from "@/components/user-avatar";
import { AvatarChangeDialog } from "@/components/avatar-change-dialog";

const STYLE_OPTIONS = Object.values(StylePreset);
const NEUTRAL_OPTIONS = Object.values(NeutralColor);
const BASE_OPTIONS = Object.values(BaseColor);

const MODE_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const;

export function SidebarUser() {
  const user = useUser();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const { isMobile } = useSidebar();
  const {
    config,
    setStyle,
    setNeutralColor,
    setBaseColor,
    setRadius,
    setMode,
  } = useTheme();
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate({ to: "/login" });
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              data-testid="user-menu-trigger"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <UserAvatar
                name={user.name}
                email={user.email}
                avatarConfig={user.avatarConfig}
                className="h-8 w-8 rounded-lg"
                fallbackClassName="rounded-lg"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">{user.email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <UserAvatar
                  name={user.name}
                  email={user.email}
                  avatarConfig={user.avatarConfig}
                  className="h-8 w-8 rounded-lg"
                  fallbackClassName="rounded-lg"
                />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{user.email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />

            {/* Style sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Paintbrush className="mr-2 h-4 w-4" />
                Style
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {STYLE_OPTIONS.map((style) => (
                  <DropdownMenuItem
                    key={style}
                    onSelect={(e) => {
                      e.preventDefault();
                      setStyle(style);
                    }}
                  >
                    <span className="capitalize">{style}</span>
                    {config.style === style && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Theme mode sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Sun className="mr-2 h-4 w-4" />
                Theme
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {(Object.entries(MODE_ICONS) as [ThemeMode, typeof Sun][]).map(([mode, Icon]) => (
                  <DropdownMenuItem
                    key={mode}
                    onSelect={(e) => {
                      e.preventDefault();
                      setMode(mode);
                    }}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span className="capitalize">{mode}</span>
                    {config.mode === mode && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Neutral color sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Circle className="mr-2 h-4 w-4" />
                Neutral Color
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {NEUTRAL_OPTIONS.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    onSelect={(e) => {
                      e.preventDefault();
                      setNeutralColor(color);
                    }}
                  >
                    <span
                      className="mr-2 h-4 w-4 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: NEUTRAL_SWATCH_COLORS[color] }}
                    />
                    <span className="capitalize">{color}</span>
                    {config.neutralColor === color && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Base color sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Palette className="mr-2 h-4 w-4" />
                Base Color
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {BASE_OPTIONS.map((color) => (
                  <DropdownMenuItem
                    key={color}
                    onSelect={(e) => {
                      e.preventDefault();
                      setBaseColor(color);
                    }}
                  >
                    <span
                      className="mr-2 h-4 w-4 rounded-full inline-block shrink-0"
                      style={{ backgroundColor: BASE_SWATCH_COLORS[color] }}
                    />
                    <span className="capitalize">{color}</span>
                    {config.baseColor === color && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            {/* Radius sub-menu */}
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Radius className="mr-2 h-4 w-4" />
                Radius
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {RADIUS_OPTIONS.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onSelect={(e) => {
                      e.preventDefault();
                      setRadius(r);
                    }}
                  >
                    {r}
                    {config.radius === r && <Check className="ml-auto h-4 w-4" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => setAvatarDialogOpen(true)}>
              <UserRoundCog className="mr-2 h-4 w-4" />
              Change Avatar
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/admin/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/change-password">
                <KeyRound className="mr-2 h-4 w-4" />
                Change Password
              </Link>
            </DropdownMenuItem>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={handleLogout} data-testid="sign-out-button">
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AvatarChangeDialog open={avatarDialogOpen} onOpenChange={setAvatarDialogOpen} />
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
