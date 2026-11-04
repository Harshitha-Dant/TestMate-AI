import type { ApiHistoryEntry, TestSuite } from "@testmate/shared";
import { useState, type FormEvent } from "react";
import { apiStudioApi } from "../../api/apiStudio";
import { ApiClientError, errorMessage } from "../../api/client";
import { suitesApi } from "../../api/testing";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { SelectField } from "../../components/ui/SelectField";
import type { RequestDraft } from "./draft";

const NEW_SUITE = "__new__";

interface Props {
  projectId: number;
  draft: RequestDraft;
  suites: TestSuite[];
  /** When set, offers to update this saved request instead of creating a new one. */
  existing: ApiHistoryEntry | null;
  onClose: () => void;
  onSaved: (entry: ApiHistoryEntry) => void;
}

export function SaveRequestModal({ projectId, draft, suites, existing, onClose, onSaved }: Props) {
  const [name, setName] = useState(draft.name || existing?.name || "");
  const [suite, setSuite] = useState<string>(draft.suiteId ? String(draft.suiteId) : "");
  const [newSuiteName, setNewSuiteName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<"new" | "update" | null>(null);

  async function save(mode: "new" | "update", e?: FormEvent) {
    e?.preventDefault();
    setSaving(mode);
    setErrors({});
    try {
      let suiteId: number | null = suite && suite !== NEW_SUITE ? Number(suite) : null;
      if (suite === NEW_SUITE) {
        if (!newSuiteName.trim()) {
          setErrors({ suite: "Name the new suite" });
          return;
        }
        suiteId = (await suitesApi.create(projectId, "api", { name: newSuiteName.trim() })).id;
      }
      const input = { ...draft, name: name.trim(), suiteId };
      onSaved(mode === "update" && existing ? await apiStudioApi.updateSaved(projectId, existing.id, input) : await apiStudioApi.createSaved(projectId, input));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") setErrors(err.fieldErrors());
      else if (err instanceof ApiClientError && err.code === "CONFLICT") setErrors({ suite: err.message });
      else setErrors({ _: errorMessage(err) });
    } finally {
      setSaving(null);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Save request"
      description="Saved requests are stored with secret-like values masked. Use {{secret:NAME}} for credentials you want to re-run."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          {existing && (
            <Button loading={saving === "update"} onClick={() => save("update")}>
              Update "{existing.name}"
            </Button>
          )}
          <Button variant="primary" type="submit" form="save-request-form" loading={saving === "new"}>
            {existing ? "Save as new" : "Save"}
          </Button>
        </>
      }
    >
      <form id="save-request-form" onSubmit={(e) => save("new", e)} className="space-y-4" noValidate>
        <TextField label="Name" value={name} maxLength={120} error={errors.name} placeholder="e.g. Get order by id" onChange={(e) => setName(e.target.value)} />
        <SelectField
          label="Suite"
          value={suite}
          onChange={(e) => setSuite(e.target.value)}
          options={[
            { value: "", label: "No suite" },
            ...suites.map((s) => ({ value: String(s.id), label: s.name })),
            { value: NEW_SUITE, label: "+ New suite…" },
          ]}
          error={suite !== NEW_SUITE ? errors.suite : undefined}
        />
        {suite === NEW_SUITE && (
          <TextField label="New suite name" value={newSuiteName} maxLength={80} error={errors.suite} onChange={(e) => setNewSuiteName(e.target.value)} />
        )}
        {errors._ && <p className="text-sm text-failure">{errors._}</p>}
      </form>
    </Modal>
  );
}
