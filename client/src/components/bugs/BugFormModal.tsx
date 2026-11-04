import {
  BUG_CATEGORIES,
  BUG_CATEGORY_LABELS,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  TEST_MODULES,
  type Bug,
  type BugCategory,
  type BugInput,
  type BugSeverity,
  type TestModule,
} from "@testmate/shared";
import { useCallback, useState, type FormEvent } from "react";
import { ApiClientError, errorMessage } from "../../api/client";
import { bugsApi } from "../../api/quality";
import { useAsync } from "../../hooks/useAsync";
import { Button } from "../ui/Button";
import { TextAreaField, TextField } from "../ui/Field";
import { Modal } from "../ui/Modal";
import { SelectField } from "../ui/SelectField";
import { ErrorState, LoadingState } from "../ui/States";

const MODULE_LABELS: Record<TestModule, string> = { chatbot: "Chatbot", memory: "Memory", multilingual: "Multilingual", api: "API" };

const BLANK: BugInput = { title: "", module: null, category: "other", severity: "medium", failureExplanation: "", notes: "" };

interface Props {
  projectId: number;
  /** When set, the form is prefilled from this failed execution and linked to it. */
  executionId?: number | null;
  onClose: () => void;
  onCreated: (bug: Bug) => void;
}

export function BugFormModal({ projectId, executionId, onClose, onCreated }: Props) {
  const load = useCallback(
    () => (executionId ? bugsApi.suggest(projectId, executionId) : Promise.resolve(BLANK)),
    [projectId, executionId],
  );
  const { data, loading, error, reload } = useAsync(load);

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      title={executionId ? "Report bug from this result" : "New bug"}
      description={executionId ? "Prefilled from the failed checks. Category and severity are suggestions; adjust them as needed." : undefined}
    >
      {loading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : (
        data && <BugForm projectId={projectId} initial={data} onCancel={onClose} onCreated={onCreated} />
      )}
    </Modal>
  );
}

function BugForm({ projectId, initial, onCancel, onCreated }: { projectId: number; initial: BugInput; onCancel: () => void; onCreated: (b: Bug) => void }) {
  const [form, setForm] = useState<BugInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof BugInput>(k: K, v: BugInput[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      onCreated(await bugsApi.create(projectId, form));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") setErrors(err.fieldErrors());
      else setErrors({ _: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <TextField label="Title" value={form.title} maxLength={120} error={errors.title} onChange={(e) => set("title", e.target.value)} />
      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label="Severity"
          value={form.severity}
          onChange={(e) => set("severity", e.target.value as BugSeverity)}
          options={BUG_SEVERITIES.map((s) => ({ value: s, label: BUG_SEVERITY_LABELS[s] }))}
        />
        <SelectField
          label="Category"
          value={form.category}
          onChange={(e) => set("category", e.target.value as BugCategory)}
          options={BUG_CATEGORIES.map((c) => ({ value: c, label: BUG_CATEGORY_LABELS[c] }))}
        />
        <SelectField
          label="Module"
          value={form.module ?? ""}
          onChange={(e) => set("module", (e.target.value || null) as TestModule | null)}
          options={[{ value: "", label: "Not specific" }, ...TEST_MODULES.map((m) => ({ value: m, label: MODULE_LABELS[m] }))]}
        />
      </div>
      <TextAreaField
        label="Failure explanation"
        value={form.failureExplanation}
        maxLength={5000}
        error={errors.failureExplanation}
        onChange={(e) => set("failureExplanation", e.target.value)}
      />
      <TextAreaField label="Notes" hint="Optional" value={form.notes} maxLength={5000} onChange={(e) => set("notes", e.target.value)} />
      {form.executionId && <p className="text-xs text-muted">Linked to test result #{form.executionId}.</p>}
      {errors._ && <p className="text-sm text-failure">{errors._}</p>}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button variant="primary" type="submit" loading={saving}>
          Create bug
        </Button>
      </div>
    </form>
  );
}
