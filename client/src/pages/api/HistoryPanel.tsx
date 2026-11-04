import type { ApiHistoryEntry } from "@testmate/shared";
import { History, Trash2 } from "lucide-react";
import { Button, IconButton } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";
import { METHOD_TONE, shortUrl } from "./draft";

interface Props {
  items: ApiHistoryEntry[] | undefined;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  activeId: number | null;
  onOpen: (e: ApiHistoryEntry) => void;
  onDelete: (e: ApiHistoryEntry) => void;
  onClear: () => void;
}

export function HistoryPanel({ items, loading, error, onRetry, activeId, onOpen, onDelete, onClear }: Props) {
  return (
    <Card className="p-4">
      <CardHeader
        title="History"
        hint="Every send, newest first. Click to reopen."
        action={
          items && items.length > 0 ? (
            <Button size="sm" variant="ghost" onClick={onClear}>
              Clear
            </Button>
          ) : undefined
        }
      />
      <div className="mt-3">
        {loading ? (
          <LoadingState className="py-6" />
        ) : error ? (
          <ErrorState className="py-6" message={error.message} onRetry={onRetry} />
        ) : !items?.length ? (
          <EmptyState className="py-6" icon={<History className="size-5" aria-hidden />} title="No requests sent yet" />
        ) : (
          <ul className="-mx-1 max-h-96 space-y-0.5 overflow-y-auto">
            {items.map((e) => (
              <li key={e.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onOpen(e)}
                  aria-current={activeId === e.id}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg px-2 py-2 pr-9 text-left transition-colors",
                    activeId === e.id ? "bg-card-2" : "hover:bg-fg/[0.03]",
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2 text-xs">
                    <span className={cn("w-12 shrink-0 font-mono font-semibold", METHOD_TONE[e.method])}>{e.method}</span>
                    <span className="truncate font-mono text-muted">{shortUrl(e.url)}</span>
                  </span>
                  <span className="flex items-center gap-2 pl-14 text-[11px] text-muted">
                    {e.lastRun && <StatusBadge status={e.lastRun.status} />}
                    {e.response ? `${e.response.status} · ${e.response.timeMs} ms` : e.error ? e.error.kind.replace(/_/g, " ") : ""}
                    <span className="ml-auto">{formatRelative(e.createdAt)}</span>
                  </span>
                </button>
                <IconButton
                  label="Delete from history"
                  className="absolute top-1.5 right-1 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-failure"
                  icon={<Trash2 className="size-3.5" aria-hidden />}
                  onClick={() => onDelete(e)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
