import type { ApiHistoryEntry, ExecutionStatus, TestSuite } from "@testmate/shared";
import { Bookmark, ListChecks, Play, Trash2 } from "lucide-react";
import { Button, IconButton } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { METHOD_TONE } from "./draft";

interface Props {
  items: ApiHistoryEntry[] | undefined;
  suites: TestSuite[];
  loading: boolean;
  error?: Error;
  onRetry: () => void;
  activeId: number | null;
  results: Record<number, ExecutionStatus>;
  runningId: number | null;
  runningSuiteId: number | null;
  onOpen: (e: ApiHistoryEntry) => void;
  onRun: (e: ApiHistoryEntry) => void;
  onRunSuite: (s: TestSuite) => void;
  onDelete: (e: ApiHistoryEntry) => void;
}

/** Saved requests grouped by suite; suites can be run as a whole. */
export function SavedPanel(p: Props) {
  const groups = new Map<number | null, ApiHistoryEntry[]>();
  for (const e of p.items ?? []) groups.set(e.suiteId, [...(groups.get(e.suiteId) ?? []), e]);
  const suiteName = (id: number | null) => (id === null ? "Not in a suite" : (p.suites.find((s) => s.id === id)?.name ?? "Suite"));

  return (
    <Card className="p-4">
      <CardHeader title="Saved requests" hint="Reusable requests; group them in suites to run together." />
      <div className="mt-3">
        {p.loading ? (
          <LoadingState className="py-6" />
        ) : p.error ? (
          <ErrorState className="py-6" message={p.error.message} onRetry={p.onRetry} />
        ) : !p.items?.length ? (
          <EmptyState className="py-6" icon={<Bookmark className="size-5" aria-hidden />} title="Nothing saved yet" description="Build a request and choose Save." />
        ) : (
          <div className="space-y-3">
            {[...groups].map(([suiteId, entries]) => {
              const suite = p.suites.find((s) => s.id === suiteId);
              return (
                <div key={suiteId ?? "none"}>
                  <div className="mb-1 flex items-center justify-between gap-2 px-1">
                    <p className="truncate text-[11px] font-medium tracking-wide text-muted uppercase">{suiteName(suiteId)}</p>
                    {suite && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<ListChecks className="size-3.5" aria-hidden />}
                        loading={p.runningSuiteId === suite.id}
                        disabled={p.runningSuiteId !== null || p.runningId !== null}
                        onClick={() => p.onRunSuite(suite)}
                      >
                        Run all
                      </Button>
                    )}
                  </div>
                  <ul className="space-y-0.5">
                    {entries.map((e) => (
                      <li key={e.id} className="group relative">
                        <button
                          type="button"
                          onClick={() => p.onOpen(e)}
                          aria-current={p.activeId === e.id}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-lg px-2 py-2 pr-16 text-left text-sm transition-colors",
                            p.activeId === e.id ? "bg-card-2" : "hover:bg-fg/[0.03]",
                          )}
                        >
                          <span className={cn("w-12 shrink-0 font-mono text-xs font-semibold", METHOD_TONE[e.method])}>{e.method}</span>
                          <span className="min-w-0 flex-1 truncate">{e.name}</span>
                          {p.results[e.id] && <StatusBadge status={p.results[e.id]!} />}
                        </button>
                        <div className="absolute top-1/2 right-1 flex -translate-y-1/2">
                          <IconButton
                            label={`Run ${e.name}`}
                            loading={p.runningId === e.id}
                            disabled={p.runningId !== null || p.runningSuiteId !== null}
                            icon={<Play className="size-3.5" aria-hidden />}
                            onClick={() => p.onRun(e)}
                          />
                          <IconButton
                            label={`Delete ${e.name}`}
                            className="hover:text-failure"
                            icon={<Trash2 className="size-3.5" aria-hidden />}
                            onClick={() => p.onDelete(e)}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
