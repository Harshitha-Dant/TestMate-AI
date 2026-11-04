import type { TestModule, TestSuite } from "@testmate/shared";
import { useState, type FormEvent } from "react";
import { ApiClientError, errorMessage } from "../../api/client";
import { suitesApi } from "../../api/testing";
import { Button } from "../ui/Button";
import { TextAreaField, TextField } from "../ui/Field";
import { Modal } from "../ui/Modal";

interface Props {
  projectId: number;
  module: TestModule;
  suite?: TestSuite;
  onClose: () => void;
  onSaved: (suite: TestSuite) => void;
}

export function SuiteFormModal({ projectId, module, suite, onClose, onSaved }: Props) {
  const [name, setName] = useState(suite?.name ?? "");
  const [description, setDescription] = useState(suite?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErrors({ name: "Name is required" });
    setSaving(true);
    setErrors({});
    try {
      const input = { name: name.trim(), description: description.trim() };
      onSaved(suite ? await suitesApi.update(projectId, suite.id, input) : await suitesApi.create(projectId, module, input));
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "VALIDATION_ERROR") setErrors(err.fieldErrors());
      else if (err instanceof ApiClientError && err.code === "CONFLICT") setErrors({ name: err.message });
      else setErrors({ _: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={suite ? "Edit suite" : "New suite"}
      description="Suites group tests so you can run them together and compare runs over time."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="suite-form" loading={saving}>
            {suite ? "Save" : "Create suite"}
          </Button>
        </>
      }
    >
      <form id="suite-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField label="Name" value={name} maxLength={80} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <TextAreaField
          label="Description"
          hint="Optional"
          value={description}
          maxLength={500}
          error={errors.description}
          onChange={(e) => setDescription(e.target.value)}
        />
        {errors._ && <p className="text-sm text-failure">{errors._}</p>}
      </form>
    </Modal>
  );
}
