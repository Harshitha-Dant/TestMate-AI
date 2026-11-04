import type { Execution } from "@testmate/shared";
import { History } from "lucide-react";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";
import { StatusBadge } from "../ui/StatusBadge";

interface Props {
  items: Execution[];
  total: number;
  viewingId: number | undefined;
  onView: (id: number) => void;
  /** Extra text per run, e.g. "failed at turn 6". */
  describe?: (e: Execution) => string | null;
}

/** Past runs of one test or script; clicking one shows it. */
export function RunHistory({ items, total, viewingId, onView, describe }: Props) {
  if (items.length < 2) return null;
  return (
    <div className="mt-5 border-t border-line pt-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
        <History className="size-3.5" aria-hidden /> Run history ({total})
      </p>
      <ul className="space-y-1">
        {items.map((e) => {
          const extra = describe?.(e);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onView(e.id)}
                aria-current={e.id === viewingId}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors",
                  e.id === viewingId ? "bg-card-2" : "hover:bg-fg/[0.03]",
                )}
              >
                <StatusBadge status={e.effectiveStatus} overridden={!!e.override} />
                <span className="text-xs text-muted">
                  {extra && `${extra} · `}
                  {e.score !== null && `score ${e.score} · `}
                  {formatRelative(e.createdAt)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
