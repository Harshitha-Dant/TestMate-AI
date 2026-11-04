import type { ProjectWithStats } from "@testmate/shared";
import { CircleAlert, CircleCheck, CircleX, ListChecks, Sparkles } from "lucide-react";
import { useCallback, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { analyticsApi, preferencesApi } from "../../api/analytics";
import { suitesApi } from "../../api/testing";
import { ModuleBars } from "../../components/charts/ModuleBars";
import { TrendChart } from "../../components/charts/TrendChart";
import { RequireProject } from "../../components/RequireProject";
import { Badge } from "../../components/ui/Badge";
import { Card, CardHeader } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { useProjects } from "../../context/ProjectContext";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../lib/cn";
import { ApiPerformanceCard, BugsRegressionCard, LanguagesCard, MemoryHealthCard, RecentRunsCard } from "./InsightCards";
import { QualityScoreCard } from "./QualityScoreCard";
import { QuickLaunchCard } from "./QuickLaunchCard";

export function DashboardPage() {
  return <RequireProject>{(project) => <Dashboard key={project.id} project={project} />}</RequireProject>;
}

/** Every number on this page is computed by the server from stored test runs; nothing is hardcoded. */
function Dashboard({ project }: { project: ProjectWithStats }) {
  const pid = project.id;
  const { refresh: refreshProjects } = useProjects();
  const loadAnalytics = useCallback(() => analyticsApi.get(pid, null), [pid]);
  const analytics = useAsync(loadAnalytics);
  const loadSuites = useCallback(() => suitesApi.listAll(pid), [pid]);
  const suites = useAsync(loadSuites);
  const loadPrefs = useCallback(() => preferencesApi.get(), []);
  const prefs = useAsync(loadPrefs);

  if (analytics.loading) return <LoadingState label="Loading dashboard…" />;
  if (analytics.error || !analytics.data) {
    return (
      <Card>
        <ErrorState message={analytics.error?.message ?? "No data"} onRetry={analytics.reload} />
      </Card>
    );
  }
  const a = analytics.data;
  const t = a.totals;
  const empty = t.executions === 0;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Dashboard"
        description={
          <>
            {project.name}
            {project.isDemo && (
              <Badge tone="warning" className="ml-2 align-middle">
                Demo data
              </Badge>
            )}
          </>
        }
      />

      {empty && (
        <Card className="mb-4 flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <Sparkles className="size-5 shrink-0 text-accent" aria-hidden />
          <p className="flex-1 text-sm text-muted">
            No test runs in this project yet. Add tests in the{" "}
            <Link to="/chatbot" className="text-fg underline">Chatbot Lab</Link>,{" "}
            <Link to="/memory" className="text-fg underline">Memory Lab</Link> or{" "}
            <Link to="/multilingual" className="text-fg underline">Multilingual Lab</Link>, or load demo data in{" "}
            <Link to="/settings" className="text-fg underline">Settings</Link>.
          </p>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
        <div className="md:col-span-3 xl:col-span-2">
          <QualityScoreCard quality={a.quality} target={prefs.data?.qualityTarget ?? 80} />
        </div>
        <div className="grid grid-cols-2 gap-4 md:col-span-3 xl:col-span-4 xl:grid-cols-4">
          <StatTile label="Total runs" value={t.executions} icon={<ListChecks className="size-4" aria-hidden />} hint={`${t.mock} simulated · ${t.live} live`} />
          <StatTile label="Passed" value={t.passed} icon={<CircleCheck className="size-4" aria-hidden />} tone="text-success" hint={pct(t.passed, t.executions)} />
          <StatTile label="Failed" value={t.failed + t.errors} icon={<CircleX className="size-4" aria-hidden />} tone="text-failure" hint={t.errors ? `incl. ${t.errors} errors` : pct(t.failed, t.executions)} />
          <StatTile label="Needs review" value={t.needsReview} icon={<CircleAlert className="size-4" aria-hidden />} tone="text-warning" hint={pct(t.needsReview, t.executions)} />
          <Card className="col-span-2 p-5 xl:col-span-4">
            <CardHeader title="Pass rate by module" hint="Latest result of each test; needs review counts half." />
            <div className="mt-4">
              <ModuleBars modules={a.modules} />
            </div>
          </Card>
        </div>

        <Card className="min-w-0 p-5 md:col-span-6 xl:col-span-4">
          <CardHeader title="Execution analytics" hint="Test runs per day, last 14 days (UTC)." />
          <div className="mt-4">
            <TrendChart data={a.trend} />
          </div>
        </Card>
        <div className="md:col-span-6 xl:col-span-2">
          <QuickLaunchCard
            projectId={pid}
            suites={suites.data}
            loading={suites.loading}
            error={suites.error}
            onRetry={suites.reload}
            onRan={() => {
              analytics.refresh();
              refreshProjects();
            }}
          />
        </div>

        <div className="md:col-span-3 xl:col-span-2">
          <RecentRunsCard recent={a.recent} />
        </div>
        <div className="md:col-span-3 xl:col-span-2">
          <MemoryHealthCard memory={a.memory} />
        </div>
        <div className="md:col-span-3 xl:col-span-2">
          <ApiPerformanceCard api={a.api} />
        </div>
        <div className="md:col-span-3 xl:col-span-3">
          <LanguagesCard languages={a.languages} />
        </div>
        <div className="md:col-span-6 xl:col-span-3">
          <BugsRegressionCard bugs={a.bugs} regression={a.regression} />
        </div>
      </div>
    </div>
  );
}

function pct(n: number, total: number): string {
  return total ? `${Math.round((n / total) * 100)}% of runs` : "no runs";
}

function StatTile({ label, value, icon, hint, tone }: { label: string; value: number; icon: ReactNode; hint: string; tone?: string }) {
  return (
    <Card className="flex flex-col justify-between p-4">
      <div className="flex items-center justify-between text-muted">
        <span className="text-xs">{label}</span>
        <span className={tone}>{icon}</span>
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
      <p className={cn("text-[11px] text-muted")}>{hint}</p>
    </Card>
  );
}
