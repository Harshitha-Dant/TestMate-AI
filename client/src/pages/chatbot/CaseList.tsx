import type { TestCase } from "@testmate/shared";
import { MessageSquareText, Play, Plus, Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";
import { langAttr } from "../../lib/languages";

interface Props {
  cases: TestCase[] | undefined;
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onRun: (c: TestCase) => void;
  runningId: number | null;
  onCreate: () => void;
  /** Extra badges per row, e.g. languages in the Multilingual Lab. */
  renderMeta?: (c: TestCase) => ReactNode;
  emptyDescription?: string;
}

export function CaseList({
  cases,
  loading,
  error,
  onRetry,
  selectedId,
  onSelect,
  onRun,
  runningId,
  onCreate,
  renderMeta,
  emptyDescription = "Add a question, the answer you expect, and the rules a good reply must follow.",
}: Props) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const visible = cases?.filter((c) => !q || c.title.toLowerCase().includes(q) || c.input.toLowerCase().includes(q));

  return (
    <Card className="flex min-h-80 flex-col">
      <div className="border-b border-line p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tests"
            aria-label="Search tests"
            className="h-9 w-full rounded-xl border border-line-strong bg-bg/60 pr-3 pl-9 text-sm placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
          />
        </div>
      </div>
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={onRetry} />
      ) : !cases?.length ? (
        <EmptyState
          icon={<MessageSquareText className="size-5" aria-hidden />}
          title="No test cases here"
          description={emptyDescription}
          action={
            <Button size="sm" variant="primary" icon={<Plus className="size-3.5" aria-hidden />} onClick={onCreate}>
              New test case
            </Button>
          }
        />
      ) : !visible?.length ? (
        <EmptyState title="No matches" description={`Nothing matches "${query}".`} />
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((c) => (
            <li key={c.id} className="relative">
              <button
                type="button"
                onClick={() => onSelect(c.id)}
                aria-current={selectedId === c.id}
                className={cn(
                  "flex w-full flex-col gap-1.5 px-4 py-3 pr-14 text-left transition-colors",
                  selectedId === c.id ? "bg-card-2" : "hover:bg-fg/[0.02]",
                )}
              >
                {selectedId === c.id && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
                <span className="truncate text-sm font-medium">{c.title}</span>
                <span className="truncate text-xs text-muted" lang={langAttr(c.inputLanguage)}>
                  {c.input}
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  {renderMeta?.(c)}
                  {c.lastRun ? (
                    <>
                      <StatusBadge status={c.lastRun.status} />
                      <span className="text-[11px] text-muted">{formatRelative(c.lastRun.at)}</span>
                    </>
                  ) : (
                    <span className="text-[11px] text-muted">Never run</span>
                  )}
                </span>
              </button>
              <IconButton
                label={`Run ${c.title}`}
                className="absolute top-3 right-3"
                loading={runningId === c.id}
                disabled={runningId !== null}
                icon={<Play className="size-3.5" aria-hidden />}
                onClick={() => onRun(c)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
