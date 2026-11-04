import { LANGUAGE_LABELS, TEST_LANGUAGES, type Preferences, type ProjectWithStats, type TestLanguage, type ThemePreference } from "@testmate/shared";
import { Database, Monitor, Moon, Pencil, Plus, Sun, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { demoApi, preferencesApi } from "../../api/analytics";
import { errorMessage } from "../../api/client";
import { Badge } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { TextField } from "../../components/ui/Field";
import { PageHeader } from "../../components/ui/PageHeader";
import { SelectField } from "../../components/ui/SelectField";
import { ErrorState, LoadingState } from "../../components/ui/States";
import { useProjects } from "../../context/ProjectContext";
import { useAsync } from "../../hooks/useAsync";
import { cn } from "../../lib/cn";
import { readTheme, saveTheme } from "../../lib/theme";
import { ApiSettingsCard } from "../api/ApiSettingsCard";
import { DeleteProjectDialog } from "../projects/DeleteProjectDialog";
import { ProjectFormModal } from "../projects/ProjectFormModal";

export function SettingsPage() {
  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" description="Appearance, defaults for new tests, request safety, projects and demo data." />
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-4">
          <AppearanceCard />
          <TestDefaultsCard />
          <ApiSettingsCard />
        </div>
        <div className="min-w-0 space-y-4">
          <ProjectsCard />
          <DemoDataCard />
        </div>
      </div>
    </div>
  );
}

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: "dark", label: "Dark", icon: Moon },
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "System", icon: Monitor },
];

function AppearanceCard() {
  const [theme, setTheme] = useState<ThemePreference>(readTheme);
  return (
    <Card className="p-5">
      <CardHeader title="Appearance" hint="Saved in this browser only." />
      <div role="radiogroup" aria-label="Theme" className="mt-4 grid grid-cols-3 gap-2">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={theme === value}
            onClick={() => {
              setTheme(value);
              saveTheme(value);
            }}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-xl border px-3 py-3 text-sm transition-colors",
              theme === value ? "border-accent/50 bg-card-2 text-fg" : "border-line text-muted hover:border-line-strong hover:text-fg",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </Card>
  );
}

function TestDefaultsCard() {
  const load = useCallback(() => preferencesApi.get(), []);
  const { data, loading, error, reload, refresh } = useAsync(load);
  return (
    <Card className="p-5">
      <CardHeader title="Test defaults & thresholds" hint="Used when you create new tests, and for the dashboard target." />
      <div className="mt-4">
        {loading ? (
          <LoadingState className="py-6" />
        ) : error ? (
          <ErrorState className="py-6" message={error.message} onRetry={reload} />
        ) : (
          data && <DefaultsForm initial={data} onSaved={refresh} />
        )}
      </div>
    </Card>
  );
}

function DefaultsForm({ initial, onSaved }: { initial: Preferences; onSaved: () => void }) {
  const [draft, setDraft] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const options = TEST_LANGUAGES.map((l) => ({ value: l, label: LANGUAGE_LABELS[l] }));
  const clamp = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      await preferencesApi.set(draft);
      setMessage({ ok: true, text: "Saved." });
      onSaved();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Question language (multilingual)"
          value={draft.defaultInputLanguage}
          onChange={(e) => setDraft({ ...draft, defaultInputLanguage: e.target.value as TestLanguage })}
          options={options}
        />
        <SelectField
          label="Reply language (multilingual)"
          value={draft.defaultExpectedLanguage}
          onChange={(e) => setDraft({ ...draft, defaultExpectedLanguage: e.target.value as TestLanguage })}
          options={options}
        />
        <TextField
          label="Default minimum relevance (%)"
          type="number"
          min={0}
          max={100}
          value={draft.defaultMinRelevance}
          hint="Word-overlap threshold for new tests."
          onChange={(e) => setDraft({ ...draft, defaultMinRelevance: clamp(e.target.value, 0, 100) })}
        />
        <TextField
          label="Quality score target"
          type="number"
          min={1}
          max={100}
          value={draft.qualityTarget}
          hint="Dashboard shows on/below target."
          onChange={(e) => setDraft({ ...draft, qualityTarget: clamp(e.target.value, 1, 100) })}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        {message ? <p className={message.ok ? "text-xs text-success" : "text-xs text-failure"}>{message.text}</p> : <span />}
        <Button size="sm" disabled={JSON.stringify(draft) === JSON.stringify(initial)} loading={saving} onClick={save}>
          Save defaults
        </Button>
      </div>
      <p className="text-[11px] text-muted">API timeouts, response size and localhost access are under Request safety.</p>
    </div>
  );
}

function ProjectsCard() {
  const { projects, active, setActiveId, loading, error, reload, refresh } = useProjects();
  const [editing, setEditing] = useState<ProjectWithStats | "new" | null>(null);
  const [deleting, setDeleting] = useState<ProjectWithStats | null>(null);
  return (
    <Card className="p-5">
      <CardHeader
        title="Projects"
        hint="All tests, runs, bugs and reports belong to a project."
        action={
          <Button size="sm" icon={<Plus className="size-3.5" aria-hidden />} onClick={() => setEditing("new")}>
            New
          </Button>
        }
      />
      <div className="mt-3">
        {loading ? (
          <LoadingState className="py-6" />
        ) : error ? (
          <ErrorState className="py-6" message={error.message} onRetry={reload} />
        ) : (
          <ul className="divide-y divide-line">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center gap-2 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm">
                    {p.name}
                    {p.id === active?.id && <Badge tone="accent">Active</Badge>}
                    {p.isDemo && <Badge tone="warning">Demo</Badge>}
                  </p>
                  <p className="text-[11px] text-muted">
                    {p.stats.testCases} tests · {p.stats.executions} runs · {p.stats.openBugs} open bugs
                  </p>
                </div>
                {p.id !== active?.id && (
                  <Button size="sm" variant="ghost" onClick={() => setActiveId(p.id)}>
                    Switch
                  </Button>
                )}
                <IconButton label={`Rename ${p.name}`} icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(p)} />
                <IconButton label={`Delete ${p.name}`} className="hover:text-failure" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={() => setDeleting(p)} />
              </li>
            ))}
          </ul>
        )}
      </div>
      {editing && (
        <ProjectFormModal
          key={editing === "new" ? "new" : editing.id}
          open
          project={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
          onSaved={(p) => {
            if (editing === "new") setActiveId(p.id);
            setEditing(null);
            refresh();
          }}
        />
      )}
      <DeleteProjectDialog
        key={deleting?.id}
        project={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          setDeleting(null);
          refresh();
        }}
      />
    </Card>
  );
}

function DemoDataCard() {
  const { projects, refresh, setActiveId } = useProjects();
  const [busy, setBusy] = useState<"seed" | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const hasDemo = projects.some((p) => p.isDemo);

  async function seed() {
    setBusy("seed");
    setMessage(null);
    try {
      const res = await demoApi.seed();
      setActiveId(res.projectId);
      setMessage({ ok: true, text: res.created ? "Demo project created and switched to." : "The demo project already exists; switched to it." });
      refresh();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="Demo data" hint='A sample "Demo: Support Bot" project, clearly labeled as demo data.' />
      <p className="mt-3 text-sm text-muted">
        Loading runs every demo test once through the simulated chatbot (no internet needed; API demo requests are saved but not
        sent). Removing deletes only demo data and never touches your own projects.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button icon={<Database className="size-4" aria-hidden />} loading={busy === "seed"} onClick={seed}>
          {hasDemo ? "Open demo project" : "Load demo data"}
        </Button>
        <Button variant="danger" disabled={!hasDemo} icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setConfirmClear(true)}>
          Remove demo data
        </Button>
      </div>
      {message && <p className={cn("mt-3 text-sm", message.ok ? "text-success" : "text-failure")}>{message.text}</p>}
      {confirmClear && (
        <ConfirmDialog
          title="Remove demo data"
          message="Delete the demo project and everything in it? Your own projects are not affected."
          confirmLabel="Remove demo data"
          onClose={() => setConfirmClear(false)}
          onConfirm={async () => {
            await demoApi.clear();
            setConfirmClear(false);
            setMessage({ ok: true, text: "Demo data removed." });
            refresh();
          }}
        />
      )}
    </Card>
  );
}
