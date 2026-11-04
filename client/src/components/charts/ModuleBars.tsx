import type { ModuleStat } from "@testmate/shared";
import { MODULE_NAMES } from "../../lib/modules";

/**
 * Pass rate per module as labeled horizontal bars (one series, so one hue and no legend; values are
 * direct labels in text color). Modules without results say so instead of drawing a zero bar.
 */
export function ModuleBars({ modules }: { modules: ModuleStat[] }) {
  return (
    <ul className="space-y-3">
      {modules.map((m) => (
        <li key={m.module}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="text-fg">{MODULE_NAMES[m.module]}</span>
            <span className="text-muted">
              {m.passRate === null ? (
                "No results"
              ) : (
                <>
                  <span className="font-medium tabular-nums text-fg">{m.passRate}%</span> · {m.tests} test{m.tests === 1 ? "" : "s"}
                </>
              )}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-fg/5" role="img" aria-label={`${MODULE_NAMES[m.module]}: ${m.passRate === null ? "no results" : `${m.passRate}% pass rate`}`}>
            {m.passRate !== null && <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(m.passRate, 1)}%` }} />}
          </div>
        </li>
      ))}
    </ul>
  );
}
