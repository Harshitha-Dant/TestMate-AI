import type { ResultSource, SuiteRunResult } from "@testmate/shared";
import { X } from "lucide-react";
import { IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { SourceBadge } from "../../components/ui/StatusBadge";

export function SuiteRunBanner({
  suiteName,
  result,
  onDismiss,
  itemNoun = "tests",
  source = "mock",
}: {
  suiteName: string;
  result: SuiteRunResult;
  onDismiss: () => void;
  itemNoun?: string;
  source?: ResultSource;
}) {
  const rate = result.total ? Math.round((result.passed / result.total) * 100) : 0;
  const stats = [
    { label: "Passed", value: result.passed, className: "text-success" },
    { label: "Failed", value: result.failed, className: "text-failure" },
    { label: "Needs review", value: result.needsReview, className: "text-warning" },
    ...(result.errors ? [{ label: "Errors", value: result.errors, className: "text-failure" }] : []),
  ];
  return (
    <Card className="animate-fade-in mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 p-4" role="status">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">Ran “{suiteName}”</p>
          <SourceBadge source={source} />
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {result.total} {itemNoun} · {rate}% passed
        </p>
      </div>
      <dl className="flex gap-6">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-[11px] text-muted">{s.label}</dt>
            <dd className={`text-xl font-semibold tabular-nums ${s.className}`}>{s.value}</dd>
          </div>
        ))}
      </dl>
      <IconButton label="Dismiss" icon={<X className="size-4" aria-hidden />} onClick={onDismiss} />
    </Card>
  );
}
