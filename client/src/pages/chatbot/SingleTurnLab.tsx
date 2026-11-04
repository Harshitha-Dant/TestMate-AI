import type { ProjectWithStats, SuiteRunResult, TestCase, TestSuite } from "@testmate/shared";
import { ListChecks, Play, Plus } from "lucide-react";
import { DEFAULT_PREFERENCES } from "@testmate/shared";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { preferencesApi } from "../../api/analytics";
import { errorMessage } from "../../api/client";
import { suitesApi, testCasesApi } from "../../api/testing";
import { ChatbotTargetPanel } from "../../components/provider/ChatbotTargetPanel";
import { SuiteFormModal } from "../../components/suites/SuiteFormModal";
import { SuitePanel, type SuiteFilter } from "../../components/suites/SuitePanel";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState } from "../../components/ui/States";
import { useProjects } from "../../context/ProjectContext";
import { useAsync } from "../../hooks/useAsync";
import { CaseDetail } from "./CaseDetail";
import { CaseList } from "./CaseList";
import { SuiteRunBanner } from "./SuiteRunBanner";
import { TestCaseFormModal } from "./TestCaseFormModal";

export interface LabContext {
  /** Changes after every run, so dependent views (e.g. summaries) can reload. */
  resultsVersion: number;
  /** Call after creating data outside the lab's own forms. */
  onDataChanged: () => void;
}

interface Props {
  project: ProjectWithStats;
  module: TestCase["module"];
  title: string;
  description: string;
  notice: ReactNode;
  emptyDescription?: string;
  /** Rendered between the notice and the lab grid. */
  renderTop?: (ctx: LabContext) => ReactNode;
  extraActions?: (ctx: LabContext) => ReactNode;
  renderCaseMeta?: (c: TestCase) => ReactNode;
}

type Dialog =
  | { kind: "case"; testCase?: TestCase }
  | { kind: "suite"; suite?: TestSuite }
  | { kind: "deleteCase"; testCase: TestCase }
  | { kind: "deleteSuite"; suite: TestSuite };

/** Suites + test list + detail panel for single-turn labs (Chatbot and Multilingual). */
export function SingleTurnLab({
  project,
  module,
  title,
  description,
  notice,
  emptyDescription,
  renderTop,
  extraActions,
  renderCaseMeta,
}: Props) {
  const pid = project.id;
  const { refresh: refreshProjects } = useProjects();
  const [filter, setFilter] = useState<SuiteFilter>("all");
  // ?case=<id> (e.g. from Test History) preselects a test.
  const [params] = useSearchParams();
  const [selectedId, setSelectedId] = useState<number | null>(() => Number(params.get("case")) || null);
  const loadPrefs = useCallback(() => preferencesApi.get(), []);
  const prefs = useAsync(loadPrefs).data ?? DEFAULT_PREFERENCES;
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [runningId, setRunningId] = useState<number | null>(null);
  const [suiteRun, setSuiteRun] = useState<{ name: string; result: SuiteRunResult } | null>(null);
  const [runningSuite, setRunningSuite] = useState(false);
  const [actionError, setActionError] = useState<string>();
  // Bumped after runs so the detail panel reloads its execution history.
  const [resultsVersion, setResultsVersion] = useState(0);
  const detailRef = useRef<HTMLDivElement>(null);

  const loadSuites = useCallback(() => suitesApi.list(pid, module), [pid, module]);
  const suites = useAsync(loadSuites);
  const loadCases = useCallback(
    () => testCasesApi.list(pid, module, filter === "all" ? undefined : filter),
    [pid, module, filter],
  );
  const cases = useAsync(loadCases);

  const selected = cases.data?.find((c) => c.id === selectedId) ?? null;
  const activeSuite = typeof filter === "number" ? suites.data?.find((s) => s.id === filter) : undefined;

  const afterDataChange = () => {
    cases.refresh();
    suites.refresh();
    refreshProjects();
  };
  const ctx: LabContext = {
    resultsVersion,
    onDataChanged: () => {
      afterDataChange();
      setResultsVersion((v) => v + 1);
    },
  };

  const select = (id: number) => {
    setSelectedId(id);
    if (!window.matchMedia("(min-width: 1280px)").matches) {
      requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    }
  };

  async function runCase(c: TestCase) {
    setRunningId(c.id);
    setActionError(undefined);
    try {
      await testCasesApi.run(pid, c.id);
      setSelectedId(c.id);
      setResultsVersion((v) => v + 1);
      afterDataChange();
    } catch (err) {
      setActionError(`Couldn't run "${c.title}": ${errorMessage(err)}`);
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
        title={title}
        description={description}
        actions={
          <>
            {activeSuite && (
              <Button
                icon={<ListChecks className="size-4" aria-hidden />}
                loading={runningSuite}
                disabled={activeSuite.itemCount === 0 || runningId !== null}
                title={activeSuite.itemCount === 0 ? "This suite has no tests yet" : undefined}
                onClick={() => runSuite(activeSuite)}
              >
                Run suite ({activeSuite.itemCount})
              </Button>
            )}
            {extraActions?.(ctx)}
            <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={() => setDialog({ kind: "case" })}>
              New test case
            </Button>
          </>
        }
      />

      {notice}

      {actionError && (
        <p role="alert" className="mb-4 rounded-xl border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-failure">
          {actionError}
        </p>
      )}
      {suiteRun && <SuiteRunBanner suiteName={suiteRun.name} result={suiteRun.result} onDismiss={() => setSuiteRun(null)} />}

      {renderTop?.(ctx)}

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4 lg:row-span-2 xl:row-span-1">
          <SuitePanel
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
          <ChatbotTargetPanel projectId={pid} onChanged={() => setResultsVersion((v) => v + 1)} />
        </div>

        <CaseList
          cases={cases.data}
          loading={cases.loading}
          error={cases.error}
          onRetry={cases.reload}
          selectedId={selected?.id ?? null}
          onSelect={select}
          onRun={runCase}
          runningId={runningId}
          onCreate={() => setDialog({ kind: "case" })}
          renderMeta={renderCaseMeta}
          emptyDescription={emptyDescription}
        />

        <div ref={detailRef} className="scroll-mt-20 lg:col-start-2 xl:col-start-auto">
          {selected ? (
            <CaseDetail
              key={`${selected.id}-${resultsVersion}`}
              testCase={selected}
              running={runningId === selected.id}
              onRun={() => runCase(selected)}
              onEdit={() => setDialog({ kind: "case", testCase: selected })}
              onDelete={() => setDialog({ kind: "deleteCase", testCase: selected })}
              onOverridden={() => {
                cases.refresh();
                setResultsVersion((v) => v + 1);
              }}
            />
          ) : (
            <Card>
              <EmptyState
                icon={<Play className="size-5" aria-hidden />}
                title="Select a test case"
                description="Pick a test to see its criteria, latest result, every check and the run history."
              />
            </Card>
          )}
        </div>
      </div>

      {dialog?.kind === "case" && (
        <TestCaseFormModal
          projectId={pid}
          module={module}
          suites={suites.data ?? []}
          testCase={dialog.testCase}
          defaultSuiteId={typeof filter === "number" ? filter : null}
          defaults={{
            inputLanguage: prefs.defaultInputLanguage,
            expectedLanguage: prefs.defaultExpectedLanguage,
            minRelevance: prefs.defaultMinRelevance,
          }}
          onClose={() => setDialog(null)}
          onSaved={(c) => {
            setDialog(null);
            setSelectedId(c.id);
            afterDataChange();
          }}
        />
      )}
      {dialog?.kind === "suite" && (
        <SuiteFormModal
          projectId={pid}
          module={module}
          suite={dialog.suite}
          onClose={() => setDialog(null)}
          onSaved={(s) => {
            setDialog(null);
            setFilter(s.id);
            afterDataChange();
          }}
        />
      )}
      {dialog?.kind === "deleteCase" && (
        <ConfirmDialog
          title="Delete test case"
          message={`Delete "${dialog.testCase.title}"? Its past runs stay in Test History.`}
          confirmLabel="Delete test case"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await testCasesApi.remove(pid, dialog.testCase.id);
            setDialog(null);
            setSelectedId(null);
            ctx.onDataChanged();
          }}
        />
      )}
      {dialog?.kind === "deleteSuite" && (
        <ConfirmDialog
          title="Delete suite"
          message={`Delete "${dialog.suite.name}"? Its ${dialog.suite.itemCount} tests are kept and moved to "Not in a suite".`}
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
