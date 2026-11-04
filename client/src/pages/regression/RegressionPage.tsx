import type { ProjectWithStats, RegressionRunSummary } from "@testmate/shared";
import { GitCompareArrows } from "lucide-react";
import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { regressionApi } from "../../api/quality";
import { suitesApi } from "../../api/testing";
import { BugFormModal } from "../../components/bugs/BugFormModal";
import { ExecutionModal } from "../../components/execution/ExecutionModal";
import { RequireProject } from "../../components/RequireProject";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { useProjects } from "../../context/ProjectContext";
import { useAsync } from "../../hooks/useAsync";
import { DiffView } from "./DiffView";
import { RunRegressionCard } from "./RunRegressionCard";
import { RunsList } from "./RunsList";

export function RegressionPage() {
  return <RequireProject>{(project) => <Regression key={project.id} project={project} />}</RequireProject>;
}

type Dialog = { kind: "execution"; id: number } | { kind: "bug"; executionId: number } | { kind: "deleteRun"; run: RegressionRunSummary };

function Regression({ project }: { project: ProjectWithStats }) {
  const pid = project.id;
  const { refresh: refreshProjects } = useProjects();
  const [chosenSuiteId, setChosenSuiteId] = useState<number | null>(null);
  const [chosenRunId, setChosenRunId] = useState<number | null>(null);
  const [compareFromId, setCompareFromId] = useState<number | null>(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string; bugs?: number } | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const loadSuites = useCallback(() => suitesApi.listAll(pid), [pid]);
  const suites = useAsync(loadSuites);
  const loadAllRuns = useCallback(() => regressionApi.list(pid), [pid]);
  const allRuns = useAsync(loadAllRuns);

  // Default suite: the one run most recently, else the first suite with tests.
  const suiteId =
    chosenSuiteId ?? allRuns.data?.[0]?.suiteId ?? suites.data?.find((s) => s.itemCount > 0)?.id ?? suites.data?.[0]?.id ?? null;
  const runs = (allRuns.data ?? []).filter((r) => r.suiteId === suiteId);
  const runId = runs.some((r) => r.id === chosenRunId) ? chosenRunId : (runs[0]?.id ?? null);

  const loadDiff = useCallback(() => {
    if (runId === null) return Promise.resolve(null);
    return compareFromId !== null && compareFromId !== runId ? regressionApi.compare(pid, compareFromId, runId) : regressionApi.detail(pid, runId);
  }, [pid, runId, compareFromId]);
  const diff = useAsync(loadDiff);

  async function run(input: { label: string; baselineRunId: number | null; createBugs: boolean }) {
    if (suiteId === null) return;
    setRunning(true);
    setMessage(null);
    try {
      const res = await regressionApi.run(pid, { suiteId, label: input.label || undefined, baselineRunId: input.baselineRunId, createBugs: input.createBugs });
      setChosenRunId(res.diff.to.id);
      setCompareFromId(null);
      const nf = res.diff.counts.new_failure;
      setMessage({
        ok: nf === 0,
        text: `"${res.diff.to.label}" finished: ${res.diff.to.passRate}% passed, ${nf} new failure${nf === 1 ? "" : "s"}, ${res.diff.counts.fixed} fixed.`,
        bugs: res.bugsCreated.length,
      });
      allRuns.refresh();
      refreshProjects();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setRunning(false);
    }
  }

  const loading = suites.loading || allRuns.loading;
  const error = suites.error ?? allRuns.error;

  return (
    <div className="animate-fade-in">
      <PageHeader title="Regression testing" description="Snapshot a suite, re-run it after changes, and see exactly what broke or got fixed." />

      {loading ? (
        <LoadingState />
      ) : error ? (
        <Card>
          <ErrorState
            message={error.message}
            onRetry={() => {
              suites.reload();
              allRuns.reload();
            }}
          />
        </Card>
      ) : !suites.data?.length ? (
        <Card>
          <EmptyState
            icon={<GitCompareArrows className="size-5" aria-hidden />}
            title="No suites yet"
            description="Regression runs work on suites. Create one in a lab and add tests to it."
            action={
              <Link to="/chatbot" className="text-sm text-accent hover:underline">
                Open the Chatbot Lab
              </Link>
            }
          />
        </Card>
      ) : (
        <>
          {message && (
            <p
              role="status"
              className={
                message.ok
                  ? "mb-4 rounded-xl border border-success/30 bg-success/10 px-3 py-2 text-sm text-success"
                  : "mb-4 rounded-xl border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-failure"
              }
            >
              {message.text}
              {message.bugs ? (
                <>
                  {" "}
                  <Link to="/bugs" className="underline">
                    {message.bugs} bug{message.bugs === 1 ? "" : "s"} opened
                  </Link>
                  .
                </>
              ) : null}
            </p>
          )}
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="min-w-0 space-y-4">
              <RunRegressionCard
                suites={suites.data}
                suiteId={suiteId}
                onSuiteChange={(id) => {
                  setChosenSuiteId(id);
                  setChosenRunId(null);
                  setCompareFromId(null);
                }}
                runs={runs}
                running={running}
                onRun={run}
              />
              <RunsList
                runs={runs}
                selectedId={runId}
                onSelect={(id) => {
                  setChosenRunId(id);
                  setCompareFromId(null);
                }}
                onDelete={(r) => setDialog({ kind: "deleteRun", run: r })}
              />
            </div>
            <div className="min-w-0">
              {runId === null ? (
                <Card>
                  <EmptyState
                    icon={<GitCompareArrows className="size-5" aria-hidden />}
                    title="Run this suite to create a baseline"
                    description="Each later run is compared test by test: new failures, fixes, status changes, added and removed tests."
                  />
                </Card>
              ) : diff.loading ? (
                <LoadingState />
              ) : diff.error ? (
                <Card>
                  <ErrorState message={diff.error.message} onRetry={diff.reload} />
                </Card>
              ) : (
                diff.data && (
                  <DiffView
                    diff={diff.data}
                    runs={runs}
                    compareFromId={compareFromId}
                    onCompareFrom={setCompareFromId}
                    onView={(id) => setDialog({ kind: "execution", id })}
                    onReportBug={(executionId) => setDialog({ kind: "bug", executionId })}
                  />
                )
              )}
            </div>
          </div>
        </>
      )}

      {dialog?.kind === "execution" && <ExecutionModal projectId={pid} executionId={dialog.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === "bug" && (
        <BugFormModal
          projectId={pid}
          executionId={dialog.executionId}
          onClose={() => setDialog(null)}
          onCreated={(bug) => {
            setDialog(null);
            setMessage({ ok: true, text: `Bug #${bug.id} reported.` });
            refreshProjects();
          }}
        />
      )}
      {dialog?.kind === "deleteRun" && (
        <ConfirmDialog
          title="Delete regression run"
          message={`Delete "${dialog.run.label}"? Its test results stay in Test History; runs that used it as a baseline lose their comparison.`}
          confirmLabel="Delete run"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await regressionApi.remove(pid, dialog.run.id);
            setDialog(null);
            allRuns.refresh();
          }}
        />
      )}
    </div>
  );
}
