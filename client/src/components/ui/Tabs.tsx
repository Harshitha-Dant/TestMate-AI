import { useId, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
}

/** Accessible tab strip (arrow keys move between tabs). Render the active panel yourself below it. */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div
      role="tablist"
      className={cn("flex gap-1 border-b border-line", className)}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        const i = tabs.findIndex((t) => t.id === active);
        const next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]!;
        onChange(next.id);
        document.getElementById(`${id}-${next.id}`)?.focus();
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          id={`${id}-${t.id}`}
          type="button"
          role="tab"
          aria-selected={t.id === active}
          tabIndex={t.id === active ? 0 : -1}
          onClick={() => onChange(t.id)}
          className={cn(
            "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
            t.id === active ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
