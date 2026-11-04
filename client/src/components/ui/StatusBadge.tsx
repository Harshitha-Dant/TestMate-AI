import type { ExecutionStatus, ResultSource } from "@testmate/shared";
import { CircleAlert, CircleCheck, CircleX, FlaskConical, TriangleAlert } from "lucide-react";
import { Badge, type BadgeTone } from "./Badge";

const STATUS: Record<ExecutionStatus, { label: string; tone: BadgeTone; icon: typeof CircleCheck }> = {
  passed: { label: "Passed", tone: "success", icon: CircleCheck },
  failed: { label: "Failed", tone: "failure", icon: CircleX },
  needs_review: { label: "Needs review", tone: "warning", icon: CircleAlert },
  error: { label: "Error", tone: "failure", icon: TriangleAlert },
};

export function statusLabel(status: ExecutionStatus): string {
  return STATUS[status].label;
}

export function StatusBadge({ status, overridden }: { status: ExecutionStatus; overridden?: boolean }) {
  const { label, tone, icon: Icon } = STATUS[status];
  return (
    <Badge tone={tone}>
      <Icon className="size-3" aria-hidden />
      {label}
      {overridden && <span className="opacity-70">· manual</span>}
    </Badge>
  );
}

/** Required wherever a mock result is shown: simulated output must never pass as a real AI response. */
export function SourceBadge({ source }: { source: ResultSource }) {
  return source === "mock" ? (
    <Badge tone="accent" className="uppercase tracking-wide">
      <FlaskConical className="size-3" aria-hidden />
      Simulated
    </Badge>
  ) : (
    <Badge tone="neutral" className="uppercase tracking-wide">
      Live
    </Badge>
  );
}
