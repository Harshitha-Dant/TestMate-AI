import { BUG_SEVERITIES, BUG_SEVERITY_LABELS, type Analytics, type MemoryIssueType } from "@testmate/shared";
import { Link } from "react-router-dom";
import { MODULE_NAMES } from "../../lib/modules";
import { Card, CardHeader } from "../../components/ui/Card";
import { SourceBadge, StatusBadge } from "../../components/ui/StatusBadge";
import { cn } from "../../lib/cn";
import { formatRelative } from "../../lib/format";
import { languageName } from "../../lib/languages";

const ISSUE_LABELS: Record<MemoryIssueType, string> = {
  context_loss: "Context loss",
  wrong_memory: "Wrong memory",
  contradiction: "Contradiction",
  follow_up_invalid: "Invalid follow-up",
  missing_info: "Missing info",
  empty_reply: "Empty reply",
};

function Metric({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="rounded-xl bg-card-2 px-3 py-2">
      <p className="text-[11px] text-muted">{label}</p>
      <p className={cn("text-lg font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function CardLink({ to, children }: { to: string; children: string }) {
  return (
    <Link to={to} className="text-xs text-muted hover:text-fg hover:underline">
      {children}
    </Link>
  );
}

export function RecentRunsCard({ recent }: { recent: Analytics["recent"] }) {
  return (
    <Card className="h-full p-5">
      <CardHeader title="Recent runs" action={<CardLink to="/history">All history</CardLink>} />
      {recent.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No runs yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {recent.map((r) => (
            <li key={r.id} className="flex items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{r.title}</p>
                <p className="text-[11px] text-muted">
                  {MODULE_NAMES[r.module]} · {formatRelative(r.createdAt)}
                </p>
              </div>
              {r.source === "mock" && <SourceBadge source="mock" />}
              <StatusBadge status={r.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function MemoryHealthCard({ memory }: { memory: Analytics["memory"] }) {
  const issues = (Object.entries(memory.issues) as [MemoryIssueType, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...issues.map(([, n]) => n));
  return (
    <Card className="h-full p-5">
      <CardHeader title="Conversation memory health" action={<CardLink to="/memory">Memory Lab</CardLink>} />
      {memory.scripts === 0 ? (
        <p className="mt-4 text-sm text-muted">No memory scripts run yet.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Metric label="Scripts passing" value={memory.passRate === null ? "–" : `${memory.passRate}%`} />
            <Metric label="Breaks at turn (avg)" value={memory.avgFirstFailureTurn ?? "–"} />
          </div>
          <p className="mt-4 mb-2 text-xs text-muted">Issues in the latest runs</p>
          {issues.length === 0 ? (
            <p className="text-sm text-success">No memory issues found.</p>
          ) : (
            <ul className="space-y-1.5">
              {issues.map(([type, n]) => (
                <li key={type} className="flex items-center gap-2 text-xs">
                  <span className="w-28 shrink-0 text-muted">{ISSUE_LABELS[type]}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/5">
                    <span className="block h-full rounded-full bg-accent" style={{ width: `${(n / max) * 100}%` }} />
                  </span>
                  <span className="w-5 text-right tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

export function ApiPerformanceCard({ api }: { api: Analytics["api"] }) {
  return (
    <Card className="h-full p-5">
      <CardHeader title="API performance" action={<CardLink to="/api-studio">API Studio</CardLink>} />
      {api.requests === 0 ? (
        <p className="mt-4 text-sm text-muted">No API requests sent yet.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Metric label="Avg" value={api.avgMs === null ? "–" : `${api.avgMs} ms`} />
            <Metric label="p95" value={api.p95Ms === null ? "–" : `${api.p95Ms} ms`} />
            <Metric label="Passing" value={api.passRate === null ? "–" : `${api.passRate}%`} />
          </div>
          <p className="mt-3 text-xs text-muted">
            {api.requests} requests · {api.errors} errors
            {api.blocked ? ` · ${api.blocked} blocked by SSRF protection` : ""}
          </p>
          {api.slowest.length > 0 && (
            <ul className="mt-3 space-y-1">
              {api.slowest.map((s) => (
                <li key={s.endpoint} className="flex justify-between gap-2 text-xs">
                  <span className="truncate font-mono text-muted">{s.endpoint}</span>
                  <span className="shrink-0 tabular-nums">{s.avgMs} ms</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}

export function LanguagesCard({ languages }: { languages: Analytics["languages"] }) {
  return (
    <Card className="h-full p-5">
      <CardHeader title="Multilingual summary" action={<CardLink to="/multilingual">Multilingual Lab</CardLink>} />
      {languages.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No multilingual tests yet.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {languages.map((l) => (
            <li key={l.language} className="flex items-center gap-3 text-xs">
              <span className="w-20 shrink-0">{languageName(l.language)}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/5">
                {l.passRate !== null && <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.max(l.passRate, 1)}%` }} />}
              </span>
              <span className="w-10 text-right tabular-nums">{l.passRate === null ? "–" : `${l.passRate}%`}</span>
              <span className={cn("w-20 text-right", l.wrongLanguage ? "text-failure" : "text-muted")}>
                {l.wrongLanguage ? `${l.wrongLanguage} wrong lang` : "no mix-ups"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function BugsRegressionCard({ bugs, regression }: { bugs: Analytics["bugs"]; regression: Analytics["regression"] }) {
  const open = bugs.byStatus.open + bugs.byStatus.in_progress;
  const latest = regression[0];
  return (
    <Card className="h-full p-5">
      <CardHeader title="Bugs & regressions" action={<CardLink to="/bugs">Bugs</CardLink>} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="Unresolved bugs" value={open} tone={open ? "text-failure" : undefined} />
        <Metric label="Resolved" value={bugs.byStatus.resolved} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {BUG_SEVERITIES.map((s) => (
          <span key={s}>
            {BUG_SEVERITY_LABELS[s]} <span className="tabular-nums text-fg">{bugs.openBySeverity[s]}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 border-t border-line pt-3 text-sm">
        {latest ? (
          <Link to="/regression" className="group block">
            <p className="text-xs text-muted">Latest regression run</p>
            <p className="group-hover:underline">
              {latest.label} · {latest.suiteName}
            </p>
            <p className="text-xs text-muted">
              {latest.passRate}% passed
              {latest.passRateDelta !== null && (
                <span className={latest.passRateDelta < 0 ? "text-failure" : latest.passRateDelta > 0 ? "text-success" : ""}>
                  {" "}
                  ({latest.passRateDelta > 0 ? "+" : ""}
                  {latest.passRateDelta} pts)
                </span>
              )}
              {latest.newFailures > 0 && <span className="text-failure"> · {latest.newFailures} new failures</span>}
            </p>
          </Link>
        ) : (
          <p className="text-xs text-muted">No regression runs yet.</p>
        )}
      </div>
    </Card>
  );
}
