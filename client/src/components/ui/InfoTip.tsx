import { Info } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

/** Small "i" button that shows an explanation on hover, focus or tap. */
export function InfoTip({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-label={label}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className="rounded-full p-0.5 text-muted hover:text-fg"
      >
        <Info className="size-3.5" aria-hidden />
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="animate-fade-in absolute top-full left-1/2 z-30 mt-2 w-72 max-w-[80vw] -translate-x-1/2 rounded-xl border border-line-strong bg-card-2 p-3 text-xs leading-relaxed text-muted shadow-2xl"
        >
          {children}
        </span>
      )}
    </span>
  );
}
