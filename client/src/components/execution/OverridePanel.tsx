import type { Execution, ExecutionOverride } from "@testmate/shared";
import { Gavel } from "lucide-react";
import { useState, type FormEvent } from "react";
import { ApiClientError, errorMessage } from "../../api/client";
import { executionsApi } from "../../api/testing";
import { formatDateTime } from "../../lib/format";
import { Button } from "../ui/Button";
import { TextAreaField } from "../ui/Field";
import { SelectField } from "../ui/SelectField";
import { statusLabel } from "../ui/StatusBadge";

const OPTIONS: { value: ExecutionOverride["status"]; label: string }[] = [
  { value: "passed", label: "Passed" },
  { value: "failed", label: "Failed" },
  { value: "needs_review", label: "Needs review" },
];

/** Manual verdict on top of the evaluator's. The original evaluator status is always kept and shown. */
export function OverridePanel({ execution, onChanged }: { execution: Execution; onChanged: (e: Execution) => void }) {
  const [editing, setEditing] = useState(false);
  const firstOther = OPTIONS.find((o) => o.value !== execution.status)?.value ?? "passed";
  const [status, setStatus] = useState<ExecutionOverride["status"]>(firstOther);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save(next: ExecutionOverride["status"] | null, e?: FormEvent) {
    e?.preventDefault();
    setSaving(true);
    setError(undefined);
    try {
      const updated = await executionsApi.override(execution.projectId, execution.id, { status: next, note });
      setEditing(false);
      setNote("");
      onChanged(updated);
    } catch (err) {
      setError(err instanceof ApiClientError ? (err.fieldErrors().note ?? err.message) : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (execution.override) {
    return (
      <div className="rounded-xl border border-warning/25 bg-warning/5 p-3 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p>
            <span className="font-medium">Manually marked {statusLabel(execution.override.status).toLowerCase()}</span>
            <span className="text-muted"> · evaluator said {statusLabel(execution.status).toLowerCase()}</span>
          </p>
          <Button size="sm" variant="ghost" loading={saving} onClick={() => save(null)}>
            Clear override
          </Button>
        </div>
        <p className="mt-1 text-muted">“{execution.override.note}”</p>
        <p className="mt-1 text-xs text-muted/70">{formatDateTime(execution.override.at)}</p>
        {error && <p className="mt-2 text-xs text-failure">{error}</p>}
      </div>
    );
  }

  if (!editing || execution.status === "error") {
    return execution.status === "error" ? null : (
      <Button size="sm" variant="ghost" icon={<Gavel className="size-3.5" aria-hidden />} onClick={() => setEditing(true)}>
        Override result
      </Button>
    );
  }

  return (
    <form onSubmit={(e) => save(status, e)} className="space-y-3 rounded-xl border border-line bg-card-2/50 p-3">
      <SelectField
        label="Mark this result as"
        value={status}
        onChange={(e) => setStatus(e.target.value as ExecutionOverride["status"])}
        options={OPTIONS.filter((o) => o.value !== execution.status)}
      />
      <TextAreaField
        label="Reason"
        value={note}
        maxLength={1000}
        placeholder="Why does this verdict differ from the evaluator's?"
        onChange={(e) => setNote(e.target.value)}
        error={error}
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" loading={saving}>
          Save override
        </Button>
      </div>
    </form>
  );
}
