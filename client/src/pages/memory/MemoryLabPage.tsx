import type { ConversationScript, ProjectWithStats, SuiteRunResult, TestSuite } from "@testmate/shared";
import { Brain, Eye, ListChecks, Plus } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { errorMessage } from "../../api/client";
import { conversationsApi, suitesApi } from "../../api/testing";
import { ChatbotTargetPanel } from "../../components/provider/ChatbotTargetPanel";
import { RequireProject } from "../../components/RequireProject";
import { SuiteFormModal } from "../../components/suites/SuiteFormModal";
import { SuitePanel, type SuiteFilter } from "../../components/suites/SuitePanel";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/States";
import { useProjects } from "../../context/ProjectContext";
import { useAsync } from "../../hooks/useAsync";
import { SuiteRunBanner } from "../chatbot/SuiteRunBanner";
import { ScriptDetail } from "./ScriptDetail";
import { ScriptFormModal } from "./ScriptFormModal";
import { ScriptList } from "./ScriptList";

export function MemoryLabPage() {
  return <RequireProject>{(project) => <MemoryLab key={project.id} project={project} />}</RequireProject>;
}

type Dialog =
  | { kind: "script"; script?: ConversationScript }
  | { kind: "suite"; suite?: TestSuite }
  | { kind: "deleteScript"; script: ConversationScript }
  | { kind: "deleteSuite"; suite: TestSuite };

function MemoryLab({ project }: { project: ProjectWithStats }) {
  const pid = project.id;
  const { refresh: refreshProjects } = useProjects();
  const [filter, setFilter] = useState<SuiteFilter>("all");
  // ?script=<id> (e.g. from Test History) preselects a script.
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(params.get("script")) || null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [suiteRun, setSuiteRun] = useState<{ name: string; result: SuiteRunResult } | null>(null);
  const [runningSuite, setRunningSuite] = useState(false);
  const [actionError, setActionError] = useState<string>();
  // Bumped after runs (and bot setting changes) so the detail panel reloads its history.
  const [resultsVersion, setResultsVersion] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);

  const loadSuites = useCallback(() => suitesApi.list(pid, "memory"), [pid]);
  const suites = useAsync(loadSuites);
  const loadScripts = useCallback(() => conversationsApi.list(pid, filter === "all" ? undefined : filter), [pid, filter]);
  const scripts = useAsync(loadScripts);

  const selected = scripts.data?.find((s) => s.id === selectedId) ?? null;
  const activeSuite = typeof filter === "number" ? suites.data?.find((s) => s.id === filter) : undefined;

  const afterDataChange = () => {
    scripts.refresh();
    suites.refresh();
    refreshProjects();
  };

  const select = (id: number) => {
    setSelectedId(id);
    if (!window.matchMedia("(min-width: 1280px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  async function runScript(s: ConversationScript) {
    setRunningId(s.id);
    setActionError(undefined);
    try {
      await conversationsApi.run(pid, s.id);
      setSelectedId(s.id);
      setResultsVersion((v) => v + 1);
      afterDataChange();
    } catch (err) {
      setActionError(`Couldn't run "${s.title}": ${errorMessage(err)}`);
    } finally {
      setRunningId(null);
    }
  }

  async function runSuite(suite: TestSuite) {
    setRunningSuite(true);
    setActionError(undefined);
    try {
      const result = await suitesApi.run(pid, suite.id);
      setSuiteRun({ name: suite.name, result });
      setResultsVersion((v) => v + 1);
      afterDataChange();
    } catch (err) {
      setActionError(`Couldn't run suite "${suite.name}": ${errorMessage(err)}`);
    } finally {
      setRunningSuite(false);
    }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Conversation Memory Lab"
        description="Multi-turn scripts that catch context loss, contradictions, wrong memory and broken follow-ups."
        actions={
          <>
            {activeSuite && (
              <Button
                icon={<ListChecks className="size-4" aria-hidden />}
                loading={runningSuite}
                disabled={activeSuite.itemCount === 0 || runningId !== null}
                onClick={() => runSuite(activeSuite)}
              >
                Run suite ({activeSuite.itemCount})
              </Button>
            )}
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setDialog({ kind: "script" })}>
              New script
            </Button>
          </>
        }
      />

      <p className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-card/60 px-3 py-2 text-xs text-muted">
        <Eye className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
        <span>
          The <span className="text-fg">simulated bot</span> only remembers the last N user turns (its memory window), so
          facts given earlier are forgotten on purpose. You can also point the lab at a live endpoint. Facts and contradictions are detected with{" "}
          <span className="text-fg">English phrase patterns</span> such as "my name is…", "I live in…" and "your name is…".
          This is a heuristic, not language understanding.
        </span>
      </p>

      {actionError && (
        <p role="alert" className="mb-4 rounded-xl border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-failure">
          {actionError}
        </p>
      )}
      {suiteRun && (
        <SuiteRunBanner itemNoun="scripts" suiteName={suiteRun.name} result={suiteRun.result} onDismiss={() => setSuiteRun(null)} />
      )}

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,0.9fr)_minmax(0,1.3fr)]">
        <div className="space-y-4 lg:row-span-2 xl:row-span-1">
          <SuitePanel
            itemNoun="scripts"
            suites={suites.data}
            loading={suites.loading}
            error={suites.error}
            onRetry={suites.reload}
            filter={filter}
            onFilter={(f) => {
              setFilter(f);
              setSuiteRun(null);
            }}
            onCreate={() => setDialog({ kind: "suite" })}
            onEdit={(suite) => setDialog({ kind: "suite", suite })}
            onDelete={(suite) => setDialog({ kind: "deleteSuite", suite })}
          />
          <ChatbotTargetPanel projectId={pid} memoryWindowLabel onChanged={() => setResultsVersion((v) => v + 1)} />
        </div>

        <ScriptList
          scripts={scripts.data}
          loading={scripts.loading}
          error={scripts.error}
          onRetry={scripts.reload}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onRun={runScript}
          runningId={runningId}
          onCreate={() => setDialog({ kind: "script" })}
        />

        <div ref={detailRef} className="scroll-mt-20 lg:col-start-2 xl:col-start-auto">
          {selected ? (
            <ScriptDetail
              key={`${selected.id}-${resultsVersion}`}
              script={selected}
              running={runningId === selected.id}
              onRun={() => runScript(selected)}
              onEdit={() => setDialog({ kind: "script", script: selected })}
              onDelete={() => setDialog({ kind: "deleteScript", script: selected })}
              onOverridden={() => scripts.refresh()}
            />
          ) : (
            <Card>
              <EmptyState
                icon={<Brain className="size-5" aria-hidden />}
                title="Select a script"
                description="Pick a script to see its turns, the latest transcript and the exact turn where memory broke."
              />
            </Card>
          )}
        </div>
      </div>

      {dialog?.kind === "script" && (
        <ScriptFormModal
          projectId={pid}
          suites={suites.data ?? []}
          script={dialog.script}
          defaultSuiteId={typeof filter === "number" ? filter : null}
          onClose={() => setDialog(null)}
          onSaved={(s) => {
            setDialog(null);
            setSelectedId(s.id);
            afterDataChange();
          }}
        />
      )}
      {dialog?.kind === "suite" && (
        <SuiteFormModal
          projectId={pid}
          module="memory"
          suite={dialog.suite}
          onClose={() => setDialog(null)}
          onSaved={(s) => {
            setDialog(null);
            setFilter(s.id);
            afterDataChange();
          }}
        />
      )}
      {dialog?.kind === "deleteScript" && (
        <ConfirmDialog
          title="Delete script"
          message={`Delete "${dialog.script.title}"? Its past runs stay in Test History.`}
          confirmLabel="Delete script"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await conversationsApi.remove(pid, dialog.script.id);
            setDialog(null);
            setSelectedId(null);
            afterDataChange();
          }}
        />
      )}
      {dialog?.kind === "deleteSuite" && (
        <ConfirmDialog
          title="Delete suite"
          message={`Delete "${dialog.suite.name}"? Its ${dialog.suite.itemCount} scripts are kept and moved to "Not in a suite".`}
          confirmLabel="Delete suite"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await suitesApi.remove(pid, dialog.suite.id);
            setDialog(null);
            if (filter === dialog.suite.id) setFilter("all");
            afterDataChange();
          }}
        />
      )}
    </div>
  );
}
