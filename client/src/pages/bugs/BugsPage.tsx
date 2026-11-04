import {
  BUG_CATEGORY_LABELS,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  BUG_STATUSES,
  BUG_STATUS_LABELS,
  TEST_MODULES,
  type BugSeverity,
  type BugStatus,
  type ProjectWithStats,
  type TestModule,
} from "@testmate/shared";
import { Bug as BugIcon, Plus, Search } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { bugsApi } from "../../api/quality";
import { BugStatusBadge, SeverityBadge } from "../../components/bugs/BugBadges";
import { BugFormModal } from "../../components/bugs/BugFormModal";
import { ExecutionModal } from "../../components/execution/ExecutionModal";
import { RequireProject } from "../../components/RequireProject";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { useProjects } from "../../context/ProjectContext";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";
import { MODULE_LABELS } from "../regression/regressionUi";
import { BugDetailPanel } from "./BugDetailPanel";

export function BugsPage() {
  return <RequireProject>{(project) => <Bugs key={project.id} project={project} />}</RequireProject>;
}

const SEVERITY_BAR: Record<BugSeverity, string> = { critical: "bg-failure", high: "bg-failure/70", medium: "bg-warning", low: "bg-fg/30" };

function Bugs({ project }: { project: ProjectWithStats }) {
  const pid = project.id;
  const { refresh: refreshProjects } = useProjects();
  const [params, setParams] = useSearchParams();
  const selectedId = params.get("id") ? Number(params.get("id")) : null;
  const [status, setStatus] = useState<BugStatus | "">("");
  const [severity, setSeverity] = useState<BugSeverity | "">("");
  const [module, setModule] = useState<TestModule | "">("");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [viewExecution, setViewExecution] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);
  const detailRef = useRef<HTMLDivElement>(null);

  const loadSummary = useCallback(() => bugsApi.summary(pid), [pid]);
  const summary = useAsync(loadSummary);
  const loadList = useCallback(
    () => bugsApi.list(pid, { status: status || undefined, severity: severity || undefined, module: module || undefined, q: query.trim() || undefined }),
    [pid, status, severity, module, query],
  );
  const list = useAsync(loadList);
  const loadDetail = useCallback(() => (selectedId ? bugsApi.get(pid, selectedId) : Promise.resolve(null)), [pid, selectedId]);
  const detail = useAsync(loadDetail);

  const select = (id: number | null) => {
    setParams(id ? { id: String(id) } : {});
    if (id && !window.matchMedia("(min-width: 1280px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };
  const afterChange = () => {
    list.refresh();
    summary.refresh();
    refreshProjects();
  };

  const openCount = (summary.data?.byStatus.open ?? 0) + (summary.data?.byStatus.in_progress ?? 0);
  const maxSeverity = Math.max(1, ...BUG_SEVERITIES.map((s) => summary.data?.openBySeverity[s] ?? 0));

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Bug Intelligence"
        description="Bugs from failed tests and regressions, with severity, status and a full change history."
        actions={
          <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreating(true)}>
            New bug
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <p className="text-sm font-medium">By status</p>
          {summary.loading ? (
            <LoadingState className="py-4" />
          ) : summary.error ? (
            <ErrorState className="py-4" message={summary.error.message} onRetry={summary.reload} />
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(["", ...BUG_STATUSES] as const).map((s) => (
                <button
                  key={s || "all"}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    "rounded-xl border px-3 py-2.5 text-left transition-colors",
                    status === s ? "border-accent/40 bg-card-2" : "border-line hover:border-line-strong",
                  )}
                >
                  <span className="block text-[11px] text-muted">{s ? BUG_STATUS_LABELS[s] : "All"}</span>
                  <span className="text-xl font-semibold tabular-nums">{s ? summary.data?.byStatus[s] : summary.data?.total}</span>
                </button>
              ))}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium">
            Unresolved by severity <span className="text-muted">({openCount})</span>
          </p>
          <div className="mt-3 space-y-2">
            {BUG_SEVERITIES.map((s) => {
              const n = summary.data?.openBySeverity[s] ?? 0;
              return (
                <button key={s} type="button" onClick={() => setSeverity(severity === s ? "" : s)} className="flex w-full items-center gap-3 text-left">
                  <span className={cn("w-16 text-xs", severity === s ? "text-fg" : "text-muted")}>{BUG_SEVERITY_LABELS[s]}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-fg/5">
                    <span className={cn("block h-full rounded-full", SEVERITY_BAR[s])} style={{ width: `${(n / maxSeverity) * 100}%` }} />
                  </span>
                  <span className="w-6 text-right text-xs tabular-nums">{n}</span>
                </button>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card className="flex min-h-80 min-w-0 flex-col">
          <div className="flex flex-wrap gap-2 border-b border-line p-3">
            <div className="relative min-w-40 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search bugs"
                aria-label="Search bugs"
                className="h-9 w-full rounded-xl border border-line-strong bg-bg/60 pr-3 pl-9 text-sm placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
              />
            </div>
            <select
              aria-label="Filter by severity"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as BugSeverity | "")}
              className="h-9 rounded-xl border border-line-strong bg-bg/60 px-2 text-sm focus:border-accent/60 focus:outline-none"
            >
              <option value="">Any severity</option>
              {BUG_SEVERITIES.map((s) => (
                <option key={s} value={s}>
                  {BUG_SEVERITY_LABELS[s]}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by module"
              value={module}
              onChange={(e) => setModule(e.target.value as TestModule | "")}
              className="h-9 rounded-xl border border-line-strong bg-bg/60 px-2 text-sm focus:border-accent/60 focus:outline-none"
            >
              <option value="">Any module</option>
              {TEST_MODULES.map((m) => (
                <option key={m} value={m}>
                  {MODULE_LABELS[m]}
                </option>
              ))}
            </select>
          </div>
          {list.loading ? (
            <LoadingState />
          ) : list.error ? (
            <ErrorState message={list.error.message} onRetry={list.reload} />
          ) : !list.data?.length ? (
            <EmptyState
              icon={<BugIcon className="size-5" aria-hidden />}
              title={status || severity || module || query ? "No bugs match these filters" : "No bugs yet"}
              description="Report one from any failed test result, or let a regression run open them for new failures."
            />
          ) : (
            <ul className="divide-y divide-line">
              {list.data.map((b) => (
                <li key={b.id}>
                  <button
                    type="button"
                    onClick={() => select(b.id)}
                    aria-current={b.id === selectedId}
                    className={cn("relative flex w-full flex-col gap-1.5 px-4 py-3 text-left transition-colors", b.id === selectedId ? "bg-card-2" : "hover:bg-fg/[0.02]")}
                  >
                    {b.id === selectedId && <span className="absolute inset-y-3 left-0 w-0.5 rounded-full bg-accent" aria-hidden />}
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-medium">{b.title}</span>
                      <SeverityBadge severity={b.severity} />
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <BugStatusBadge status={b.status} />
                      {BUG_CATEGORY_LABELS[b.category]}
                      {b.module && ` · ${MODULE_LABELS[b.module]}`}
                      <span className="ml-auto">#{b.id} · {formatRelative(b.createdAt)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div ref={detailRef} className="min-w-0 scroll-mt-20">
          {!selectedId ? (
            <Card>
              <EmptyState icon={<BugIcon className="size-5" aria-hidden />} title="Select a bug" description="See its explanation, linked test result and full history." />
            </Card>
          ) : detail.loading ? (
            <LoadingState />
          ) : detail.error ? (
            <Card>
              <ErrorState message={detail.error.message} onRetry={detail.reload} />
            </Card>
          ) : (
            detail.data && (
              <BugDetailPanel
                key={detail.data.id}
                bug={detail.data}
                onChanged={() => {
                  detail.refresh();
                  afterChange();
                }}
                onDelete={() => setDeleting(true)}
                onViewExecution={setViewExecution}
              />
            )
          )}
        </div>
      </div>

      {creating && (
        <BugFormModal
          projectId={pid}
          onClose={() => setCreating(false)}
          onCreated={(bug) => {
            setCreating(false);
            afterChange();
            select(bug.id);
          }}
        />
      )}
      {viewExecution !== null && (
        <ExecutionModal projectId={pid} executionId={viewExecution} onClose={() => setViewExecution(null)} onChanged={detail.refresh} />
      )}
      {deleting && detail.data && (
        <ConfirmDialog
          title="Delete bug"
          message={`Delete bug #${detail.data.id} and its history? Consider "Won't fix" if you want to keep the record.`}
          confirmLabel="Delete bug"
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            await bugsApi.remove(pid, detail.data!.id);
            setDeleting(false);
            select(null);
            afterChange();
          }}
        />
      )}
    </div>
  );
}
