import { Link, Outlet, useLocation, useMatchRoute } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Database,
  Tags,
  Users,
  ClipboardList,
  Download,
  Mail,
  Settings,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { UserDropdown } from "./user-dropdown";

const navItems = [
  { title: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard },
  { title: "Datasets", to: "/admin/datasets", icon: Database },
  { title: "Annotation Classes", to: "/admin/annotation-classes", icon: Tags },
  { title: "Users", to: "/admin/users", icon: Users },
  { title: "Job Assignment", to: "/admin/job-assignment", icon: ClipboardList },
  { title: "Export", to: "/admin/export", icon: Download },
] as const;

export function AdminLayout() {
  const matchRoute = useMatchRoute();
  const { pathname } = useLocation();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <Link
            to="/admin/dashboard"
            className="flex items-center gap-2 px-2 py-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
          >
            <Mail className="h-5 w-5 shrink-0" />
            <span className="text-lg font-semibold group-data-[collapsible=icon]:hidden">
              Email Annotation
            </span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={!!matchRoute({ to: item.to, fuzzy: true })}
                      tooltip={item.title}
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={!!matchRoute({ to: "/admin/settings", fuzzy: true })}
                tooltip="Settings"
              >
                <Link to="/admin/settings">
                  <Settings />
                  <span>Settings</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <div className="flex flex-1 flex-col max-h-svh overflow-y-auto overflow-x-hidden">
        <header className="sticky top-0 z-10 shrink-0 flex h-14 items-center gap-4 border-b border-border/40 bg-background/50 backdrop-blur-xl px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-6" />
          <DynamicBreadcrumb />
          <div className="flex-1" />
          <UserDropdown />
        </header>
        <main className="flex-1 p-4 lg:p-6">
          <div key={pathname} className="animate-in fade-in-0 duration-150">
            <Outlet />
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
