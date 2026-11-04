import type { ConversationScript } from "@testmate/shared";
import { Brain, Play, Plus, Search } from "lucide-react";
import { useState } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";

interface Props {
  scripts: ConversationScript[] | undefined;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRun: (s: ConversationScript) => void;
  runningId: number | null;
  onCreate: () => void;
}

export function ScriptList({ scripts, loading, error, onRetry, selectedId, onSelect, onRun, runningId, onCreate }: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = scripts?.filter(
    (s) => !q || s.title.toLowerCase().includes(q) || s.turns.some((t) => t.userMessage.toLowerCase().includes(q)),
  );

  return (
    <Card className="flex min-h-80 flex-col">
      <div className="border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search scripts"
            aria-label="Search scripts"
            className="h-9 w-full rounded-xl border border-line-strong bg-bg/60 pr-3 pl-9 text-sm placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
          />
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : !scripts?.length ? (
        <EmptyState
          icon={<Brain className="size-5" aria-hidden />}
          title="No conversation scripts here"
          description='Script a multi-turn chat, e.g. "My name is Ravi" → "I live in Hyderabad" → "What is my name?"'
          action={
            <Button size="sm" variant="primary" icon={<Plus className="size-3.5" aria-hidden />} onClick={onCreate}>
              New script
            </Button>
          }
        />
      ) : !visible?.length ? (
        <EmptyState title="No matches" description={`Nothing matches "${query}".`} />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((s) => (
            <li key={s.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(s.id)}
                aria-current={selectedId === s.id}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-4 py-3 pr-14 text-left transition-colors",
                  selectedId === s.id ? "bg-card-2" : "hover:bg-fg/[0.02]",
                )}
              >
                {selectedId === s.id && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
                <span className="truncate text-sm font-medium">{s.title}</span>
                <span className="truncate text-xs text-muted">
                  {s.turns.length} turns · {s.turns[0]?.userMessage}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {s.lastRun ? (
                    <>
                      <StatusBadge status={s.lastRun.status} />
                      {s.lastRun.firstFailureTurn !== null && (
                        <span className="text-[11px] text-failure">at turn {s.lastRun.firstFailureTurn}</span>
                      )}
                      <span className="text-[11px] text-muted">{formatRelative(s.lastRun.at)}</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted">Never run</span>
                  )}
                </span>
              </button>
              <IconButton
                label={`Run ${s.title}`}
                className="absolute top-3 right-3"
                loading={runningId === s.id}
                disabled={runningId !== null}
                icon={<Play className="size-3.5" aria-hidden />}
                onClick={() => onRun(s)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
