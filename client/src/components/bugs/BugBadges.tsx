import { BUG_SEVERITY_LABELS, BUG_STATUS_LABELS, type BugSeverity, type BugStatus } from "@testmate/shared";
import { Badge, type BadgeTone } from "../ui/Badge";

const SEVERITY_TONE: Record<BugSeverity, BadgeTone> = { critical: "failure", high: "failure", medium: "warning", low: "neutral" };
const STATUS_TONE: Record<BugStatus, BadgeTone> = { open: "warning", in_progress: "accent", resolved: "success", wont_fix: "neutral" };

export function SeverityBadge({ severity }: { severity: BugSeverity }) {
  return (
    <Badge tone={SEVERITY_TONE[severity]} className={severity === "critical" ? "font-semibold uppercase" : undefined}>
      {BUG_SEVERITY_LABELS[severity]}
    </Badge>
  );
}

export function BugStatusBadge({ status }: { status: BugStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{BUG_STATUS_LABELS[status]}</Badge>;
}
