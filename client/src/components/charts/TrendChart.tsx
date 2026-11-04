import type { TrendPoint } from "@testmate/shared";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Series in stack order (bottom → top). Colors are chart-only tokens; text stays in text tokens. */
const SERIES = [
  { key: "failedOrError", label: "Failed / error", color: "var(--color-chart-fail)" },
  { key: "passed", label: "Passed", color: "var(--color-chart-pass)" },
  { key: "needsReview", label: "Needs review", color: "var(--color-chart-review)" },
] as const;

type Row = { date: string; label: string; passed: number; needsReview: number; failedOrError: number };

const dayLabel = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

function TrendTooltip({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const row = payload?.[0]?.payload as Row | undefined;
  if (!active || !row) return null;
  const total = row.passed + row.needsReview + row.failedOrError;
  return (
    <div className="rounded-xl border border-line-strong bg-card-2 px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium text-fg">{row.label}</p>
      {[...SERIES].reverse().map((s) => (
        <p key={s.key} className="flex items-center justify-between gap-4 text-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </span>
          <span className="tabular-nums text-fg">{row[s.key]}</span>
        </p>
      ))}
      <p className="mt-1 border-t border-line pt-1 text-muted">
        Total <span className="tabular-nums text-fg">{total}</span>
      </p>
    </div>
  );
}

/** Test runs per day, stacked by outcome, with a legend, hover tooltip and a table for screen readers. */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  const rows: Row[] = data.map((d) => ({
    date: d.date,
    label: dayLabel(d.date),
    passed: d.passed,
    needsReview: d.needsReview,
    failedOrError: d.failed + d.errors,
  }));
  const topKey = SERIES[SERIES.length - 1]!.key;

  return (
    <div>
      <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Legend">
        {[...SERIES].reverse().map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} aria-hidden />
            {s.label}
          </li>
        ))}
      </ul>
      <div className="h-56" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, bottom: 0, left: -18 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--color-line)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} interval="preserveStartEnd" minTickGap={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted)", fontSize: 11 }} width={40} />
            <Tooltip content={(p) => <TrendTooltip active={p.active} payload={p.payload} />} cursor={{ fill: "var(--color-fg)", fillOpacity: 0.05 }} />
            {SERIES.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                stackId="runs"
                fill={s.color}
                // A 2px surface-colored stroke separates stacked segments.
                stroke="var(--color-card)"
                strokeWidth={2}
                radius={s.key === topKey ? [4, 4, 0, 0] : 0}
                maxBarSize={28}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Test runs per day by outcome</caption>
        <thead>
          <tr>
            <th>Day</th>
            {SERIES.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.date}>
              <td>{r.label}</td>
              {SERIES.map((s) => (
                <td key={s.key}>{r[s.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
