import {
  EXECUTION_STATUSES,
  TEST_MODULES,
  type Execution,
  type ExecutionStatus,
  type ProjectWithStats,
  type ResultSource,
  type TestModule,
} from "@testmate/shared";
import { ChevronLeft, ChevronRight, ExternalLink, History, Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { executionsApi } from "../../api/testing";
import { ExecutionModal } from "../../components/execution/ExecutionModal";
import { RequireProject } from "../../components/RequireProject";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { SourceBadge, StatusBadge, statusLabel } from "../../components/ui/StatusBadge";
import { useAsync } from "../../hooks/useAsync";
import { formatDateTime, formatDuration } from "../../lib/format";
import { LAB_PATH, MODULE_NAMES } from "../../lib/modules";

const PAGE_SIZE = 25;
const SELECT =
  "h-9 rounded-xl border border-line-strong bg-bg/60 px-2 text-sm text-fg focus:border-accent/60 focus:outline-none";

export function HistoryPage() {
  return <RequireProject>{(project) => <HistoryView key={project.id} project={project} />}</RequireProject>;
}

/** Link back to the test in its lab, when the test still exists. */
function labLink(e: Execution): string | null {
  if (e.testCaseId) return `${LAB_PATH[e.module]}?case=${e.testCaseId}`;
  if (e.sessionId) return `/memory?script=${e.sessionId}`;
  if (e.module === "api") return "/api-studio";
  return null;
}

function HistoryView({ project }: { project: ProjectWithStats }) {
  const pid = project.id;
  const [module, setModule] = useState<TestModule | "">("");
  const [status, setStatus] = useState<ExecutionStatus | "">("");
  const [source, setSource] = useState<ResultSource | "">("");
  const [days, setDays] = useState<number | "">("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [viewing, setViewing] = useState<number | null>(null);

  // Debounce typing so every keystroke doesn't hit the server.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(query.trim());
      setPage(0);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(
    () =>
      executionsApi.list(pid, {
        module: module || undefined,
        status: status || undefined,
        source: source || undefined,
        days: days || undefined,
        q: debounced || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    [pid, module, status, source, days, debounced, page],
  );
  const list = useAsync(load);
  const total = list.data?.total ?? 0;
  const filtered = Boolean(module || status || source || days || debounced);
  const setFilter = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(0);
  };

  return (
    <div className="animate-fade-in">
      <PageHeader title="Test History" description="Every test run in this project, newest first. Open any run to see its full details." />

      <Card className="mb-4 flex flex-wrap gap-2 p-3">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search titles, inputs and replies"
            aria-label="Search history"
            className="h-9 w-full rounded-xl border border-line-strong bg-bg/60 pr-3 pl-9 text-sm placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
          />
        </div>
        <select aria-label="Module" value={module} onChange={(e) => setFilter(setModule)(e.target.value as TestModule | "")} className={SELECT}>
          <option value="">All modules</option>
          {TEST_MODULES.map((m) => (
            <option key={m} value={m}>
              {MODULE_NAMES[m]}
            </option>
          ))}
        </select>
        <select aria-label="Status" value={status} onChange={(e) => setFilter(setStatus)(e.target.value as ExecutionStatus | "")} className={SELECT}>
          <option value="">Any status</option>
          {EXECUTION_STATUSES.map((s) => (
            <option key={s} value={s}>
              {statusLabel(s)}
            </option>
          ))}
        </select>
        <select aria-label="Source" value={source} onChange={(e) => setFilter(setSource)(e.target.value as ResultSource | "")} className={SELECT}>
          <option value="">Simulated + live</option>
          <option value="mock">Simulated only</option>
          <option value="live">Live only</option>
        </select>
        <select aria-label="Time range" value={days} onChange={(e) => setFilter(setDays)(e.target.value ? Number(e.target.value) : "")} className={SELECT}>
          <option value="">All time</option>
          <option value="1">Last 24 hours</option>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
        </select>
      </Card>

      <Card className="min-w-0 overflow-hidden">
        {list.loading ? (
          <LoadingState />
        ) : list.error ? (
          <ErrorState message={list.error.message} onRetry={list.reload} />
        ) : !list.data?.items.length ? (
          <EmptyState
            icon={<History className="size-5" aria-hidden />}
            title={filtered ? "No runs match these filters" : "No test runs yet"}
            description={filtered ? "Try a wider time range or clear a filter." : "Runs from every lab, API Studio and regression appear here."}
          />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {list.data.items.map((e) => {
                const link = labLink(e);
                return (
                  <li key={e.id} className="flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-fg/[0.02] md:flex-row md:items-center">
                    <button type="button" onClick={() => setViewing(e.id)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate text-sm font-medium hover:underline">{e.title}</span>
                      <span className="block truncate text-xs text-muted">
                        #{e.id} · {MODULE_NAMES[e.module]} · {formatDateTime(e.createdAt)}
                        {e.regressionRunId ? " · regression run" : ""}
                      </span>
                    </button>
                    <span className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={e.effectiveStatus} overridden={!!e.override} />
                      <SourceBadge source={e.source} />
                      <span className="w-20 text-right text-xs tabular-nums text-muted">
                        {e.score !== null ? `score ${e.score}` : ""}
                      </span>
                      <span className="w-14 text-right text-xs tabular-nums text-muted">{formatDuration(e.durationMs)}</span>
                      {link ? (
                        <Link to={link} className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg" title="Open the test in its lab">
                          <ExternalLink className="size-3.5" aria-hidden /> Open
                        </Link>
                      ) : (
                        <span className="w-12 text-xs text-muted/60" title="The test was deleted">
                          deleted
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3 text-xs text-muted">
              <span>
                {page * PAGE_SIZE + 1}–{Math.min(total, (page + 1) * PAGE_SIZE)} of {total}
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page === 0} icon={<ChevronLeft className="size-3.5" aria-hidden />} onClick={() => setPage((p) => p - 1)}>
                  Newer
                </Button>
                <Button size="sm" variant="ghost" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage((p) => p + 1)}>
                  Older <ChevronRight className="size-3.5" aria-hidden />
                </Button>
              </span>
            </div>
          </>
        )}
      </Card>

      {viewing !== null && <ExecutionModal projectId={pid} executionId={viewing} onClose={() => setViewing(null)} onChanged={list.refresh} />}
    </div>
  );
}
