import { QUALITY_FORMULA, type QualityScore } from "@testmate/shared";
import { CircleAlert, CircleCheck } from "lucide-react";
import { MODULE_NAMES } from "../../lib/modules";
import { Card } from "../../components/ui/Card";
import { InfoTip } from "../../components/ui/InfoTip";

const R = 52;
const C = 2 * Math.PI * R;

/** Hero number with a ring; the formula is one tap away and every component is listed. */
export function QualityScoreCard({ quality, target }: { quality: QualityScore; target: number }) {
  const { score, components } = quality;
  const onTarget = score !== null && score >= target;
  return (
    <Card className="flex h-full flex-col p-5">
      <div className="flex items-center gap-1.5">
        <h2 className="text-sm font-medium">AI Quality Score</h2>
        <InfoTip label="How the AI Quality Score is calculated">{QUALITY_FORMULA}</InfoTip>
      </div>
      <div className="mt-4 flex items-center gap-5">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--color-fg)" strokeOpacity="0.07" strokeWidth="10" />
            {score !== null && (
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="var(--color-accent)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${(score / 100) * C} ${C}`}
              />
            )}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-3xl font-semibold tracking-tight tabular-nums">{score ?? "–"}</p>
              <p className="text-[11px] text-muted">{score === null ? "no results" : "out of 100"}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 space-y-2">
          {score === null ? (
            <p className="text-sm text-muted">Run some tests to get a score.</p>
          ) : (
            <p className={`flex items-center gap-1.5 text-sm ${onTarget ? "text-success" : "text-warning"}`}>
              {onTarget ? <CircleCheck className="size-4" aria-hidden /> : <CircleAlert className="size-4" aria-hidden />}
              {onTarget ? "On target" : "Below target"} ({target})
            </p>
          )}
          <ul className="space-y-1 text-xs text-muted">
            {components.map((c) => (
              <li key={c.module}>
                {MODULE_NAMES[c.module]} <span className="tabular-nums text-fg">{c.passRate}%</span>
                <span className="opacity-70"> × {c.weight}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-auto pt-4 text-[11px] text-muted/80">Latest result of each test; rule-based checks; mostly simulated chatbot runs.</p>
    </Card>
  );
}
