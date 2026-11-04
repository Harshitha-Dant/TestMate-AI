import type { RegressionRunSummary, TestSuite } from "@testmate/shared";
import { Play } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";
import { TextField } from "../../components/ui/Field";
import { SelectField } from "../../components/ui/SelectField";
import { formatDateTime } from "../../lib/format";
import { MODULE_LABELS } from "./regressionUi";

interface Props {
  suites: TestSuite[];
  suiteId: number | null;
  onSuiteChange: (id: number) => void;
  runs: RegressionRunSummary[];
  running: boolean;
  onRun: (input: { label: string; baselineRunId: number | null; createBugs: boolean }) => void;
}

/** Picks a suite and starts a snapshot run compared with a baseline. */
export function RunRegressionCard({ suites, suiteId, onSuiteChange, runs, running, onRun }: Props) {
  const [label, setLabel] = useState("");
  const [baseline, setBaseline] = useState("");
  const [createBugs, setCreateBugs] = useState(true);
  const suite = suites.find((s) => s.id === suiteId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onRun({ label, baselineRunId: baseline ? Number(baseline) : null, createBugs });
    setLabel("");
  };

  return (
    <Card className="p-5">
      <CardHeader title="Run a regression" hint="Re-runs every test in a suite and compares each one with a baseline run." />
      <form onSubmit={submit} className="mt-4 space-y-4">
        <SelectField
          label="Suite"
          value={suiteId === null ? "" : String(suiteId)}
          onChange={(e) => {
            onSuiteChange(Number(e.target.value));
            setBaseline("");
          }}
          options={suites.map((s) => ({ value: String(s.id), label: `${s.name} · ${MODULE_LABELS[s.module]} (${s.itemCount})` }))}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Label" value={label} maxLength={80} placeholder={`e.g. v1.${runs.length} or "after prompt change"`} onChange={(e) => setLabel(e.target.value)} />
          <SelectField
            label="Compare with"
            value={baseline}
            onChange={(e) => setBaseline(e.target.value)}
            options={[
              { value: "", label: runs.length ? "Previous run (default)" : "Nothing yet: this run becomes the baseline" },
              ...runs.map((r) => ({ value: String(r.id), label: `${r.label} · ${formatDateTime(r.createdAt)}` })),
            ]}
          />
        </div>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={createBugs} onChange={(e) => setCreateBugs(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-accent)]" />
          <span>
            Open a bug for each new failure
            <span className="block text-[11px] text-muted">Skipped when an unresolved bug already tracks that test; it gets a note instead.</span>
          </span>
        </label>
        {suite?.module === "api" && (
          <p className="text-xs text-warning">API suites send live HTTP requests; results depend on the target servers.</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" loading={running} disabled={!suite || suite.itemCount === 0} icon={<Play className="size-4" aria-hidden />}>
            {running ? "Running suite…" : "Run regression"}
          </Button>
        </div>
        {suite && suite.itemCount === 0 && <p className="text-xs text-muted">This suite has no tests yet.</p>}
      </form>
    </Card>
  );
}
