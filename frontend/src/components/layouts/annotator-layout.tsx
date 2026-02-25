import { useMemo } from "react";
import { Link, Outlet, useLocation } from "@tanstack/react-router";
import { ClipboardList } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { DynamicBreadcrumb } from "@/components/dynamic-breadcrumb";
import { HeaderSlotProvider, useHeaderSlot } from "@/lib/header-slot";
import { UserDropdown } from "./user-dropdown";
import { ThemeModeToggle } from "@/components/theme-mode-toggle";

export function AnnotatorLayout() {
  return (
    <HeaderSlotProvider>
      <AnnotatorLayoutInner />
    </HeaderSlotProvider>
  );
}

function AnnotatorLayoutInner() {
  const { breadcrumb, actions } = useHeaderSlot();
  const { pathname } = useLocation();

  // Memoize Outlet so header slot state changes don't re-render the workspace
  const outlet = useMemo(() => <Outlet />, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="relative z-10 shrink-0 flex h-14 items-center border-b border-border/40 bg-background/50 backdrop-blur-xl px-4">
        <Link
          to="/annotator/dashboard"
          className="flex items-center gap-2 font-semibold"
        >
          Email Annotation
        </Link>
        <nav className="ml-8 flex items-center gap-4">
          <Link
            to="/annotator/dashboard"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground [&.active]:text-foreground"
          >
            <ClipboardList className="h-4 w-4" />
            My Jobs
          </Link>
        </nav>
        <Separator orientation="vertical" className="mx-4 h-6" />
        {breadcrumb ?? <DynamicBreadcrumb />}
        <div className="flex-1" />
        {actions && (
          <>
            {actions}
            <Separator orientation="vertical" className="mx-4 h-6" />
          </>
        )}
        <ThemeModeToggle />
        <UserDropdown />
      </header>
      <main className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden -mt-14 pt-14">
        <div key={pathname} className="animate-in fade-in-0 duration-150 h-full">
          {outlet}
        </div>
      </main>
    </div>
  );
}
