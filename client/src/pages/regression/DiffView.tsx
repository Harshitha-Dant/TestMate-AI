import type { RegressionDiff, RegressionResultRow, RegressionRunSummary } from "@testmate/shared";
import { ArrowRight, Bug, Eye } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SelectField } from "../../components/ui/SelectField";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import { CHANGE_META, deltaTone, formatDelta } from "./regressionUi";

interface Props {
  diff: RegressionDiff;
  runs: RegressionRunSummary[];
  compareFromId: number | null;
  onCompareFrom: (id: number | null) => void;
  onView: (executionId: number) => void;
  onReportBug: (executionId: number) => void;
}

const SECTIONS = ["new_failure", "fixed", "changed", "new_test"] as const;

export function DiffView({ diff, runs, compareFromId, onCompareFrom, onView, onReportBug }: Props) {
  const { from, to, counts } = diff;
  const delta = from ? Math.round((to.passRate - from.passRate) * 10) / 10 : null;
  const unchanged = diff.results.filter((r) => r.change === "unchanged");

  const tiles = [
    { key: "new_failure", value: counts.new_failure },
    { key: "fixed", value: counts.fixed },
    { key: "changed", value: counts.changed },
    { key: "new_test", value: counts.new_test },
    { key: "removed", value: counts.removed },
  ] as const;

  return (
    <Card className="@container p-5">
      <div className="flex flex-col gap-4 @xl:flex-row @xl:items-start @xl:justify-between">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted uppercase">Comparison</p>
          <h2 className="mt-1 flex flex-wrap items-center gap-2 text-lg font-semibold">
            <span className="text-muted">{from ? from.label : "No baseline"}</span>
            <ArrowRight className="size-4 text-muted" aria-hidden />
            <span>{to.label}</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted">
            {to.suiteName} · {formatDateTime(to.createdAt)}
          </p>
        </div>
        <div className="w-full @xl:w-64">
          <SelectField
            label="Compare with"
            value={compareFromId === null ? "" : String(compareFromId)}
            onChange={(e) => onCompareFrom(e.target.value ? Number(e.target.value) : null)}
            options={[
              { value: "", label: to.baselineRunId ? "Its baseline" : "Its baseline (none)" },
              ...runs.filter((r) => r.id !== to.id).map((r) => ({ value: String(r.id), label: r.label })),
            ]}
          />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 @md:grid-cols-3 @4xl:grid-cols-6">
        <div className="col-span-2 rounded-xl bg-card-2 p-3 @md:col-span-1">
          <p className="text-[11px] text-muted">Pass rate</p>
          <p className="text-2xl font-semibold tabular-nums">{to.passRate}%</p>
          <p className={cn("text-[11px] tabular-nums", deltaTone(delta))}>
            {from ? `${formatDelta(delta)} vs ${from.passRate}%` : "first run"}
          </p>
        </div>
        {tiles.map((t) => (
          <div key={t.key} className="rounded-xl bg-card-2 p-3" title={CHANGE_META[t.key].hint}>
            <p className="text-[11px] text-muted">{CHANGE_META[t.key].label}</p>
            <p className={cn("text-2xl font-semibold tabular-nums", t.value ? CHANGE_META[t.key].tone : "text-muted/60")}>{t.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 space-y-5">
        {SECTIONS.map((change) => {
          const rows = diff.results.filter((r) => r.change === change);
          if (!rows.length) return null;
          return (
            <section key={change}>
              <h3 className={cn("mb-2 text-sm font-medium", CHANGE_META[change].tone)}>
                {CHANGE_META[change].label} <span className="text-muted">({rows.length})</span>
              </h3>
              <ul className="divide-y divide-line rounded-xl border border-line">
                {rows.map((r) => (
                  <ResultRow key={r.itemKey} row={r} onView={onView} onReportBug={onReportBug} />
                ))}
              </ul>
            </section>
          );
        })}

        {diff.removed.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-medium text-muted">Removed ({diff.removed.length})</h3>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {diff.removed.map((r) => (
                <li key={r.itemKey} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="min-w-0 truncate text-muted line-through">{r.title}</span>
                  <StatusBadge status={r.previousStatus} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {counts.new_failure + counts.fixed + counts.changed + counts.new_test + counts.removed === 0 && (
          <p className="rounded-xl border border-line px-3 py-3 text-sm text-muted">No changes: every test has the same status as in the compared run.</p>
        )}

        {unchanged.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-sm text-muted hover:text-fg">Unchanged ({unchanged.length})</summary>
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {unchanged.map((r) => (
                <ResultRow key={r.itemKey} row={r} onView={onView} onReportBug={onReportBug} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </Card>
  );
}

function ResultRow({ row, onView, onReportBug }: { row: RegressionResultRow; onView: (id: number) => void; onReportBug: (id: number) => void }) {
  const failing = row.status !== "passed";
  return (
    <li className="flex flex-col gap-2 px-3 py-2.5 @2xl:flex-row @2xl:items-center @2xl:justify-between">
      <span className="min-w-0 truncate text-sm">{row.title}</span>
      <span className="flex flex-wrap items-center gap-2">
        {row.previousStatus ? <StatusBadge status={row.previousStatus} /> : <span className="text-[11px] text-muted">new</span>}
        <ArrowRight className="size-3.5 text-muted" aria-hidden />
        <StatusBadge status={row.status} />
        {row.executionId && (
          <Button size="sm" variant="ghost" icon={<Eye className="size-3.5" aria-hidden />} onClick={() => onView(row.executionId!)}>
            View
          </Button>
        )}
        {failing && row.executionId && (
          <Button size="sm" variant="ghost" icon={<Bug className="size-3.5" aria-hidden />} onClick={() => onReportBug(row.executionId!)}>
            Bug
          </Button>
        )}
      </span>
    </li>
  );
}
