import { HTTP_METHODS, type ApiHistoryEntry, type ExecutionStatus, type HttpMethod, type ProjectWithStats, type SuiteRunResult, type TestSuite } from "@testmate/shared";
import { Bookmark, KeyRound, Network, RotateCcw, Send } from "lucide-react";
import { useCallback, useState } from "react";
import { apiStudioApi, type SendResult } from "../../api/apiStudio";
import { ApiClientError, errorMessage } from "../../api/client";
import { executionsApi, suitesApi } from "../../api/testing";
import { RequireProject } from "../../components/RequireProject";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { PageHeader } from "../../components/ui/PageHeader";
import { Tabs } from "../../components/ui/Tabs";
import { useProjects } from "../../context/ProjectContext";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../lib/cn";
import { SuiteRunBanner } from "../chatbot/SuiteRunBanner";
import { ApiSettingsCard } from "./ApiSettingsCard";
import { BodyEditor } from "./BodyEditor";
import { draftFromEntry, EMPTY_DRAFT, METHOD_TONE, type RequestDraft } from "./draft";
import { ExpectationsEditor } from "./ExpectationsEditor";
import { HeadersEditor } from "./HeadersEditor";
import { HistoryPanel } from "./HistoryPanel";
import { ResponseViewer } from "./ResponseViewer";
import { SavedPanel } from "./SavedPanel";
import { SaveRequestModal } from "./SaveRequestModal";

export function ApiStudioPage() {
  return <RequireProject>{(project) => <ApiStudio key={project.id} project={project} />}</RequireProject>;
}

type EditorTab = "headers" | "body" | "checks";
type Dialog = { kind: "save" } | { kind: "deleteSaved"; entry: ApiHistoryEntry } | { kind: "clearHistory" };

function ApiStudio({ project }: { project: ProjectWithStats }) {
  const pid = project.id;
  const { refresh: refreshProjects } = useProjects();
  const [draft, setDraft] = useState<RequestDraft>(EMPTY_DRAFT);
  const [tab, setTab] = useState<EditorTab>("headers");
  const [result, setResult] = useState<SendResult | null>(null);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string>();
  const [opened, setOpened] = useState<ApiHistoryEntry | null>(null);
  const [needsSecrets, setNeedsSecrets] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [savedResults, setSavedResults] = useState<Record<number, ExecutionStatus>>({});
  const [runningId, setRunningId] = useState<number | null>(null);
  const [runningSuiteId, setRunningSuiteId] = useState<number | null>(null);
  const [suiteRun, setSuiteRun] = useState<{ name: string; result: SuiteRunResult } | null>(null);

  const loadHistory = useCallback(() => apiStudioApi.history(pid), [pid]);
  const history = useAsync(loadHistory);
  const loadSaved = useCallback(() => apiStudioApi.saved(pid), [pid]);
  const saved = useAsync(loadSaved);
  const loadSuites = useCallback(() => suitesApi.list(pid, "api"), [pid]);
  const suites = useAsync(loadSuites);

  const patch = (p: Partial<RequestDraft>) => setDraft((d) => ({ ...d, ...p }));
  const afterRun = () => {
    history.refresh();
    refreshProjects();
  };

  async function send() {
    if (!draft.url.trim()) {
      setErrors({ url: "Enter a URL" });
      return;
    }
    setSending(true);
    setErrors({});
    setActionError(undefined);
    try {
      const res = await apiStudioApi.send(pid, draft);
      setResult(res);
      setOpened(null);
      setNeedsSecrets([]);
      afterRun();
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") {
        const fe = err.fieldErrors();
        setErrors(fe);
        if (Object.keys(fe).some((k) => k.startsWith("headers"))) setTab("headers");
        else if (Object.keys(fe).some((k) => k.startsWith("expectations"))) setTab("checks");
      } else setActionError(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  async function openEntry(entry: ApiHistoryEntry) {
    const { draft: d, needsSecrets: missing } = draftFromEntry(entry);
    setDraft(d);
    setNeedsSecrets(missing);
    setOpened(entry);
    setErrors({});
    if (entry.kind === "history" && entry.lastRun) {
      try {
        setResult({ entry, execution: await executionsApi.get(pid, entry.lastRun.executionId) });
      } catch {
        setResult(null);
      }
    } else if (entry.kind === "saved") {
      setResult(null);
    }
  }

  async function runSaved(entry: ApiHistoryEntry) {
    setRunningId(entry.id);
    setActionError(undefined);
    try {
      const res = await apiStudioApi.runSaved(pid, entry.id);
      setSavedResults((r) => ({ ...r, [entry.id]: res.execution.effectiveStatus }));
      setResult(res);
      afterRun();
    } catch (err) {
      setActionError(`Couldn't run "${entry.name}": ${errorMessage(err)}`);
    } finally {
      setRunningId(null);
    }
  }

  async function runSuite(suite: TestSuite) {
    setRunningSuiteId(suite.id);
    setActionError(undefined);
    try {
      const res = await suitesApi.run(pid, suite.id);
      // The server runs a suite's saved requests in the same order the list shows them.
      const inSuite = (saved.data ?? []).filter((e) => e.suiteId === suite.id);
      setSavedResults((r) => {
        const next = { ...r };
        inSuite.forEach((e, i) => {
          const exec = res.executions[i];
          if (exec) next[e.id] = exec.effectiveStatus;
        });
        return next;
      });
      setSuiteRun({ name: suite.name, result: res });
      afterRun();
    } catch (err) {
      setActionError(`Couldn't run suite "${suite.name}": ${errorMessage(err)}`);
    } finally {
      setRunningSuiteId(null);
    }
  }

  const headerCount = draft.headers.filter((h) => h.enabled && h.key).length;
  const checkCount = draft.expectations.fields.length + (draft.expectations.status !== null ? 1 : 0) + (draft.expectations.maxTimeMs !== null ? 1 : 0);
  const savedOpened = opened?.kind === "saved" ? opened : null;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="API Test Studio"
        description="Send real HTTP requests through the server, check status, timing and JSON fields, and keep a history."
      />

      <p className="mb-4 flex items-start gap-2 rounded-xl border border-line bg-card/60 px-3 py-2 text-xs text-muted">
        <Network className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
        <span>
          These are <span className="text-fg">live</span> requests made by the TestMate server, not simulations. Internal
          and private addresses are blocked to prevent SSRF. Keep credentials out of the browser with{" "}
          <code className="rounded bg-card-2 px-1 text-fg">{"{{secret:NAME}}"}</code>, which reads{" "}
          <code className="rounded bg-card-2 px-1 text-fg">TESTMATE_SECRET_NAME</code> from the server's .env.
        </span>
      </p>

      {actionError && (
        <p role="alert" className="mb-4 rounded-xl border border-failure/30 bg-failure/10 px-3 py-2 text-sm text-failure">
          {actionError}
        </p>
      )}
      {suiteRun && (
        <SuiteRunBanner itemNoun="requests" source="live" suiteName={suiteRun.name} result={suiteRun.result} onDismiss={() => setSuiteRun(null)} />
      )}

      {/* Side panels sit beside the editor only on very wide screens; otherwise they form a row below it. */}
      <div className="grid grid-cols-1 gap-4 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <Card className="p-4">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <label className="sr-only" htmlFor="api-method">
                Method
              </label>
              <select
                id="api-method"
                value={draft.method}
                onChange={(e) => patch({ method: e.target.value as HttpMethod })}
                className={cn(
                  "h-10 rounded-xl border border-line-strong bg-bg/60 px-3 font-mono text-sm font-semibold focus:border-accent/60 focus:outline-none sm:w-28",
                  METHOD_TONE[draft.method],
                )}
              >
                {HTTP_METHODS.map((m) => (
                  <option key={m} value={m} className="bg-card text-fg">
                    {m}
                  </option>
                ))}
              </select>
              <div className="min-w-0 flex-1">
                <label className="sr-only" htmlFor="api-url">
                  URL
                </label>
                <input
                  id="api-url"
                  value={draft.url}
                  spellCheck={false}
                  placeholder="https://jsonplaceholder.typicode.com/todos/1"
                  onChange={(e) => patch({ url: e.target.value })}
                  aria-invalid={!!errors.url}
                  className={cn(
                    "h-10 w-full rounded-xl border bg-bg/60 px-3 font-mono text-sm text-fg placeholder:text-muted/50 focus:border-accent/60 focus:outline-none",
                    errors.url ? "border-failure/60" : "border-line-strong",
                  )}
                />
                {errors.url && <p className="mt-1 text-xs text-failure">{errors.url}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="submit" variant="primary" loading={sending} icon={<Send className="size-4" aria-hidden />} title="Send (Ctrl+Enter)">
                  Send
                </Button>
                <Button icon={<Bookmark className="size-4" aria-hidden />} onClick={() => setDialog({ kind: "save" })} disabled={!draft.url.trim()}>
                  Save
                </Button>
                <Button
                  variant="ghost"
                  icon={<RotateCcw className="size-4" aria-hidden />}
                  title="New empty request"
                  aria-label="New empty request"
                  onClick={() => {
                    setDraft(EMPTY_DRAFT);
                    setOpened(null);
                    setResult(null);
                    setNeedsSecrets([]);
                    setErrors({});
                  }}
                />
              </div>
            </form>

            {opened && (
              <p className="mt-2 text-xs text-muted">
                Loaded from {opened.kind === "saved" ? `saved request "${opened.name}"` : "history"}.
              </p>
            )}
            {needsSecrets.length > 0 && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                <KeyRound className="mt-px size-3.5 shrink-0" aria-hidden />
                Masked secrets aren't stored, so re-enter {needsSecrets.join(", ")} before sending (or use {"{{secret:NAME}}"}).
              </p>
            )}

            <Tabs<EditorTab>
              className="mt-4"
              active={tab}
              onChange={setTab}
              tabs={[
                { id: "headers", label: `Headers${headerCount ? ` (${headerCount})` : ""}` },
                { id: "body", label: `Body${draft.bodyType !== "none" ? ` · ${draft.bodyType.toUpperCase()}` : ""}` },
                { id: "checks", label: `Checks${checkCount ? ` (${checkCount})` : ""}` },
              ]}
            />
            <div className="pt-4" onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && void send()}>
              {tab === "headers" && <HeadersEditor headers={draft.headers} onChange={(headers) => patch({ headers })} errors={errors} />}
              {tab === "body" && (
                <BodyEditor method={draft.method} bodyType={draft.bodyType} body={draft.body} onChange={patch} onSend={() => void send()} />
              )}
              {tab === "checks" && (
                <ExpectationsEditor
                  value={draft.expectations}
                  onChange={(expectations) => patch({ expectations })}
                  lastResponseBody={result?.entry.response?.body}
                  errors={errors}
                />
              )}
            </div>
          </Card>

          <ResponseViewer result={result} sending={sending} />
        </div>

        <div className="grid min-w-0 grid-cols-1 items-start gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-1">
          <ApiSettingsCard />
          <SavedPanel
            items={saved.data}
            suites={suites.data ?? []}
            loading={saved.loading}
            error={saved.error}
            onRetry={saved.reload}
            activeId={savedOpened?.id ?? null}
            results={savedResults}
            runningId={runningId}
            runningSuiteId={runningSuiteId}
            onOpen={openEntry}
            onRun={runSaved}
            onRunSuite={runSuite}
            onDelete={(entry) => setDialog({ kind: "deleteSaved", entry })}
          />
          <HistoryPanel
            items={history.data}
            loading={history.loading}
            error={history.error}
            onRetry={history.reload}
            activeId={opened?.kind === "history" ? opened.id : (result?.entry.id ?? null)}
            onOpen={openEntry}
            onDelete={async (entry) => {
              try {
                await apiStudioApi.removeHistory(pid, entry.id);
                if (result?.entry.id === entry.id) setResult(null);
                history.refresh();
              } catch (err) {
                setActionError(errorMessage(err));
              }
            }}
            onClear={() => setDialog({ kind: "clearHistory" })}
          />
        </div>
      </div>

      {dialog?.kind === "save" && (
        <SaveRequestModal
          projectId={pid}
          draft={draft}
          suites={suites.data ?? []}
          existing={savedOpened}
          onClose={() => setDialog(null)}
          onSaved={(entry) => {
            setDialog(null);
            setOpened(entry);
            patch({ name: entry.name, suiteId: entry.suiteId });
            saved.refresh();
            suites.refresh();
            refreshProjects();
          }}
        />
      )}
      {dialog?.kind === "deleteSaved" && (
        <ConfirmDialog
          title="Delete saved request"
          message={`Delete "${dialog.entry.name}"? Its past runs stay in history.`}
          confirmLabel="Delete"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await apiStudioApi.removeSaved(pid, dialog.entry.id);
            if (opened?.id === dialog.entry.id) setOpened(null);
            setDialog(null);
            saved.refresh();
            refreshProjects();
          }}
        />
      )}
      {dialog?.kind === "clearHistory" && (
        <ConfirmDialog
          title="Clear history"
          message="Remove every entry from this project's API history? Test results stay in Test History."
          confirmLabel="Clear history"
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await apiStudioApi.clearHistory(pid);
            setDialog(null);
            setResult(null);
            setOpened(null);
            history.refresh();
          }}
        />
      )}
    </div>
  );
}
