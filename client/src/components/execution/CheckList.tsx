import type { CheckOutcome, EvaluationCheck } from "@testmate/shared";
import { CircleAlert, CircleCheck, CircleMinus, CircleX } from "lucide-react";
import { cn } from "../../lib/cn";

const OUTCOME: Record<CheckOutcome, { icon: typeof CircleCheck; className: string; label: string }> = {
  pass: { icon: CircleCheck, className: "text-success", label: "Pass" },
  review: { icon: CircleAlert, className: "text-warning", label: "Review" },
  fail: { icon: CircleX, className: "text-failure", label: "Fail" },
  skip: { icon: CircleMinus, className: "text-muted/60", label: "Skipped" },
};

export function CheckList({ checks }: { checks: EvaluationCheck[] }) {
  return (
    <ul className="divide-y divide-line rounded-xl border border-line">
      {checks.map((c) => {
        const { icon: Icon, className, label } = OUTCOME[c.outcome];
        return (
          <li key={c.id} className={cn("flex gap-3 px-3 py-2.5", c.outcome === "skip" && "opacity-60")}>
            <Icon className={cn("mt-0.5 size-4 shrink-0", className)} aria-label={label} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{c.label}</span>
                {c.score !== undefined && <span className="text-xs tabular-nums text-muted">{c.score}%</span>}
              </div>
              <p className="mt-0.5 text-xs text-muted">{c.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
