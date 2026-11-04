import { QUALITY_FORMULA, type ProjectWithStats } from "@testmate/shared";
import { FileDown, FileText } from "lucide-react";
import { useCallback, useState } from "react";
import { analyticsApi, type RangeDays } from "../../api/analytics";
import { ModuleBars } from "../../components/charts/ModuleBars";
import { TrendChart } from "../../components/charts/TrendChart";
import { RequireProject } from "../../components/RequireProject";
import { Card, CardHeader } from "../../components/ui/Card";
import { InfoTip } from "../../components/ui/InfoTip";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../lib/cn";
import { formatDateTime } from "../../lib/format";
import { MODULE_NAMES } from "../../lib/modules";
import { ApiPerformanceCard, BugsRegressionCard, LanguagesCard, MemoryHealthCard } from "../dashboard/InsightCards";

export function ReportsPage() {
  return <RequireProject>{(project) => <Reports key={project.id} project={project} />}</RequireProject>;
}

const RANGES: { days: RangeDays; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: null, label: "All time" },
];

const LINK_BASE = "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm transition-colors";
const EXPORT_LINK = `${LINK_BASE} border border-line-strong bg-card-2 text-fg hover:border-fg/20`;
const EXPORT_LINK_PRIMARY = `${LINK_BASE} bg-fg font-medium text-bg hover:bg-fg/90`;

function Reports({ project }: { project: ProjectWithStats }) {
  const pid = project.id;
  const [days, setDays] = useState<RangeDays>(30);
  const load = useCallback(() => analyticsApi.get(pid, days), [pid, days]);
  const report = useAsync(load);
  const a = report.data;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Reports & analytics"
        description="Quality, pass rates, API performance, languages and regressions for a time range. Export as CSV or PDF."
        actions={
          <>
            <a className={EXPORT_LINK} href={analyticsApi.executionsCsvUrl(pid, days)} download>
              <FileDown className="size-4" aria-hidden /> Runs CSV
            </a>
            <a className={EXPORT_LINK} href={analyticsApi.regressionCsvUrl(pid)} download>
              <FileDown className="size-4" aria-hidden /> Regression CSV
            </a>
            <a className={EXPORT_LINK_PRIMARY} href={analyticsApi.pdfUrl(pid, days)} download>
              <FileText className="size-4" aria-hidden /> PDF report
            </a>
          </>
        }
      />

      <div role="radiogroup" aria-label="Time range" className="mb-4 inline-flex rounded-xl border border-line-strong bg-card p-1">
        {RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            role="radio"
            aria-checked={days === r.days}
            onClick={() => setDays(r.days)}
            className={cn("rounded-lg px-3 py-1.5 text-sm transition-colors", days === r.days ? "bg-card-2 text-fg" : "text-muted hover:text-fg")}
          >
            {r.label}
          </button>
        ))}
      </div>

      {report.loading ? (
        <LoadingState label="Building report…" />
      ) : report.error || !a ? (
        <Card>
          <ErrorState message={report.error?.message ?? "No data"} onRetry={report.reload} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
          <Card className="p-5 md:col-span-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs text-muted">AI Quality Score</p>
              <InfoTip label="How the score is calculated">{QUALITY_FORMULA}</InfoTip>
            </div>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{a.quality.score ?? "–"}</p>
            <p className="mt-1 text-xs text-muted">Latest result of each test in the range</p>
          </Card>
          <Card className="p-5 md:col-span-2">
            <p className="text-xs text-muted">Test runs</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">{a.totals.executions}</p>
            <p className="mt-1 text-xs text-muted">
              {a.totals.mock} simulated · {a.totals.live} live
            </p>
          </Card>
          <Card className="p-5 md:col-span-2">
            <p className="text-xs text-muted">Pass / fail rate (all runs)</p>
            <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums">
              {a.totals.executions ? `${Math.round((a.totals.passed / a.totals.executions) * 100)}%` : "–"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {a.totals.passed} passed · {a.totals.failed + a.totals.errors} failed · {a.totals.needsReview} review
            </p>
          </Card>

          <Card className="min-w-0 p-5 md:col-span-6">
            <CardHeader title="Results by module" hint="Latest result of each test; needs review counts half in the pass rate." />
            <div className="mt-4 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <div className="-mx-1 overflow-x-auto">
                <table className="w-full min-w-[440px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                      <th className="px-1 pb-2 font-medium">Module</th>
                      <th className="px-1 pb-2 text-right font-medium">Tests</th>
                      <th className="px-1 pb-2 text-right font-medium">Passed</th>
                      <th className="px-1 pb-2 text-right font-medium">Failed</th>
                      <th className="px-1 pb-2 text-right font-medium">Review</th>
                      <th className="px-1 pb-2 text-right font-medium">Avg score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {a.modules.map((m) => (
                      <tr key={m.module}>
                        <td className="px-1 py-2">{MODULE_NAMES[m.module]}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{m.tests}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{m.passed}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{m.failed + m.errors}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{m.needsReview}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{m.avgScore ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ModuleBars modules={a.modules} />
            </div>
          </Card>

          <Card className="min-w-0 p-5 md:col-span-4">
            <CardHeader title="Runs per day" hint={`Last ${a.trend.length} days (UTC).`} />
            <div className="mt-4">
              <TrendChart data={a.trend} />
            </div>
          </Card>
          <Card className="p-5 md:col-span-2">
            <CardHeader title="Chatbot quality" hint="Most frequent failing checks." />
            <p className="mt-3 text-sm">
              Average score <span className="font-semibold tabular-nums">{a.chatbot.avgScore ?? "–"}</span>{" "}
              <span className="text-muted">over {a.chatbot.tests} tests</span>
            </p>
            {a.chatbot.topFailingChecks.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No failing checks.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {a.chatbot.topFailingChecks.map((c) => (
                  <li key={c.label} className="flex justify-between py-1.5 text-sm">
                    <span>{c.label}</span>
                    <span className="tabular-nums text-muted">{c.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="md:col-span-3 xl:col-span-2">
            <MemoryHealthCard memory={a.memory} />
          </div>
          <div className="md:col-span-3 xl:col-span-2">
            <ApiPerformanceCard api={a.api} />
          </div>
          <div className="md:col-span-6 xl:col-span-2">
            <LanguagesCard languages={a.languages} />
          </div>

          <Card className="min-w-0 p-5 md:col-span-4">
            <CardHeader title="Regression report" hint="Runs in this range, newest first." />
            {a.regression.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No regression runs in this range.</p>
            ) : (
              <div className="-mx-1 mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] tracking-wide text-muted uppercase">
                      <th className="px-1 pb-2 font-medium">Run</th>
                      <th className="px-1 pb-2 font-medium">Suite</th>
                      <th className="px-1 pb-2 text-right font-medium">Pass rate</th>
                      <th className="px-1 pb-2 text-right font-medium">Change</th>
                      <th className="px-1 pb-2 text-right font-medium">New fail</th>
                      <th className="px-1 pb-2 text-right font-medium">Fixed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {a.regression.map((r) => (
                      <tr key={r.id}>
                        <td className="px-1 py-2">
                          {r.label}
                          <span className="block text-[11px] text-muted">{formatDateTime(r.createdAt)}</span>
                        </td>
                        <td className="px-1 py-2">{r.suiteName}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{r.passRate}%</td>
                        <td className={cn("px-1 py-2 text-right tabular-nums", r.passRateDelta && r.passRateDelta < 0 ? "text-failure" : r.passRateDelta ? "text-success" : "text-muted")}>
                          {r.passRateDelta === null ? "–" : `${r.passRateDelta > 0 ? "+" : ""}${r.passRateDelta} pts`}
                        </td>
                        <td className={cn("px-1 py-2 text-right tabular-nums", r.newFailures > 0 && "text-failure")}>{r.newFailures}</td>
                        <td className="px-1 py-2 text-right tabular-nums">{r.fixed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <div className="md:col-span-2">
            <BugsRegressionCard bugs={a.bugs} regression={a.regression} />
          </div>

          <p className="text-xs text-muted md:col-span-6">
            Chatbot, memory and multilingual results come from the simulated chatbot unless labeled live; all evaluation is
            rule-based. The PDF uses built-in fonts, so Telugu/Hindi text appears as "?" there. Use the CSV for full text.
          </p>
        </div>
      )}
    </div>
  );
}
