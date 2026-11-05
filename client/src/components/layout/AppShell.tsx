import { Menu, X } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { ErrorBoundary } from "../ErrorBoundary";
import { IconButton } from "../ui/Button";
import { LoadingState } from "../ui/States";
import { PublicModeBanner } from "./PublicModeBanner";
import { Brand, Sidebar } from "./Sidebar";

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[256px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh border-r border-line lg:block">
        <Sidebar />
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:hidden">
        <Brand />
        <IconButton label="Open menu" icon={<Menu className="size-5" aria-hidden />} onClick={() => setDrawerOpen(true)} />
      </div>
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside className="animate-fade-in absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-line bg-bg">
            <div className="flex items-center justify-between px-5 pt-4">
              <Brand />
              <IconButton label="Close menu" icon={<X className="size-5" aria-hidden />} onClick={() => setDrawerOpen(false)} />
            </div>
            <Sidebar onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl">
          <PublicModeBanner />
          {/* Keyed by path so navigating away from a crashed page clears the error. */}
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<LoadingState label="Loading page…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </div>
      </main>
    </div>
  );
}
