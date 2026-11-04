import { NavLink } from "react-router-dom";
import { cn } from "../../lib/cn";
import { NAV_SECTIONS } from "../../lib/nav";
import { ProjectSwitcher } from "./ProjectSwitcher";

export function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <img src="/favicon.svg" alt="" className="size-8" />
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-tight">TestMate AI</p>
        <p className="text-[11px] text-muted">Test smarter. Build reliable AI.</p>
      </div>
    </div>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex h-full flex-col gap-5 p-4">
      <div className="hidden px-1 lg:block">
        <Brand />
      </div>
      <ProjectSwitcher onNavigate={onNavigate} />
      <div className="flex-1 space-y-5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title}>
            <p className="mb-1.5 px-3 text-[10px] font-medium uppercase tracking-wider text-muted/70">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ path, label, icon: Icon }) => (
                <li key={path}>
                  <NavLink
                    to={path}
                    end={path === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                        isActive ? "bg-card text-fg" : "text-muted hover:bg-fg/[0.03] hover:text-fg",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
                        <Icon className={cn("size-4", isActive && "text-accent")} aria-hidden />
                        {label}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
