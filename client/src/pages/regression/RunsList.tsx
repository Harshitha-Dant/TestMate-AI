import type { RegressionRunSummary } from "@testmate/shared";
import { GitCompareArrows, Trash2 } from "lucide-react";
import { IconButton } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/States";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";
import { deltaTone, formatDelta } from "./regressionUi";

interface Props {
  runs: RegressionRunSummary[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (run: RegressionRunSummary) => void;
}

/** Run history for one suite with a small pass-rate trend (oldest → newest). */
export function RunsList({ runs, selectedId, onSelect, onDelete }: Props) {
  const trend = [...runs].reverse().slice(-20);
  return (
    <Card className="p-5">
      <CardHeader title="Run history" hint="Pass rate of each snapshot, oldest to newest." />
      {runs.length === 0 ? (
        <EmptyState
          className="py-8"
          icon={<GitCompareArrows className="size-5" aria-hidden />}
          title="No runs for this suite yet"
          description="Your first run becomes the baseline. Later runs are compared with it."
        />
      ) : (
        <>
          <div className="mt-4 flex h-20 items-end gap-1" role="img" aria-label={`Pass rate trend: ${trend.map((r) => `${r.label} ${r.passRate}%`).join(", ")}`}>
            {trend.map((r) => (
              <button
                key={r.id}
                type="button"
                title={`${r.label}: ${r.passRate}%`}
                onClick={() => onSelect(r.id)}
                className="group flex h-full min-w-0 max-w-10 flex-1 flex-col justify-end"
              >
                <span
                  className={cn(
                    "w-full rounded-t-md transition-colors",
                    r.id === selectedId ? "bg-accent" : "bg-fg/15 group-hover:bg-fg/25",
                  )}
                  style={{ height: `${Math.max(r.passRate, 3)}%` }}
                />
              </button>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-line">
            {runs.map((r) => (
              <li key={r.id} className="group relative">
                <button
                  type="button"
                  onClick={() => onSelect(r.id)}
                  aria-current={r.id === selectedId}
                  className={cn(
                    "grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-lg px-2 py-2.5 pr-10 text-left text-sm transition-colors",
                    r.id === selectedId ? "bg-card-2" : "hover:bg-fg/[0.03]",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{r.label}</span>
                    <span className="text-[11px] text-muted">{formatRelative(r.createdAt)}{r.isDemo ? " · demo" : ""}</span>
                  </span>
                  <span className="text-right">
                    <span className="block tabular-nums">{r.passRate}%</span>
                    <span className={cn("text-[11px] tabular-nums", deltaTone(r.passRateDelta))}>{formatDelta(r.passRateDelta)}</span>
                  </span>
                  <span className="w-20 text-right text-[11px]">
                    {r.newFailures > 0 && <span className="block text-failure">{r.newFailures} new fail</span>}
                    {r.fixed > 0 && <span className="block text-success">{r.fixed} fixed</span>}
                  </span>
                </button>
                <IconButton
                  label={`Delete run ${r.label}`}
                  className="absolute top-1/2 right-1 -translate-y-1/2 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-failure"
                  icon={<Trash2 className="size-3.5" aria-hidden />}
                  onClick={() => onDelete(r)}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
