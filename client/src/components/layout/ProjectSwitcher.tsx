import { Check, ChevronsUpDown, FolderKanban, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "../../context/ProjectContext";
import { cn } from "../../lib/cn";

/** Dropdown in the sidebar for switching the active project. All data in the app is scoped to it. */
export function ProjectSwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { projects, active, setActiveId, loading, error } = useProjects();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const go = (path: string) => {
    setOpen(false);
    onNavigate?.();
    navigate(path);
  };

  const label = loading ? "Loading projects…" : error ? "Server unavailable" : (active?.name ?? "No project yet");

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-card px-3 py-2.5 text-left transition-colors hover:border-line-strong"
      >
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-card-2 text-muted">
          <FolderKanban className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-muted">Project</span>
          <span className="block truncate text-sm font-medium">{label}</span>
        </span>
        <ChevronsUpDown className="size-4 shrink-0 text-muted" aria-hidden />
      </button>

      {open && (
        <div className="animate-fade-in absolute inset-x-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-line-strong bg-card-2 shadow-2xl">
          <ul role="listbox" aria-label="Projects" className="max-h-64 overflow-y-auto p-1">
            {projects.length === 0 && <li className="px-3 py-2 text-sm text-muted">No projects yet</li>}
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={p.id === active?.id}
                  onClick={() => {
                    setActiveId(p.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-fg/5",
                    p.id === active?.id ? "text-fg" : "text-muted",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  {p.id === active?.id && <Check className="size-4 text-accent" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-1">
            <button
              type="button"
              onClick={() => go("/projects?new=1")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-fg/5 hover:text-fg"
            >
              <Plus className="size-4" aria-hidden /> New project
            </button>
            <button
              type="button"
              onClick={() => go("/projects")}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:bg-fg/5 hover:text-fg"
            >
              <FolderKanban className="size-4" aria-hidden /> Manage projects
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
