import { useState, type FormEvent } from "react";
import type { ProjectWithStats } from "@testmate/shared";
import { ApiClientError, errorMessage } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { Button } from "../../components/ui/Button";
import { TextAreaField, TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";

interface Props {
  open: boolean;
  /** When set, the form edits this project; otherwise it creates a new one. */
  project?: ProjectWithStats;
  onClose: () => void;
  onSaved: (project: ProjectWithStats) => void;
}

export function ProjectFormModal({ open, project, onClose, onSaved }: Props) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setErrors({ name: "Name is required" });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const input = { name: name.trim(), description: description.trim() };
      const saved = project ? await projectsApi.update(project.id, input) : await projectsApi.create(input);
      onSaved(saved);
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
      open={open}
      onClose={onClose}
      title={project ? "Edit project" : "New project"}
      description={project ? undefined : "Suites, tests, runs and bugs are all scoped to a project."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="project-form" loading={saving}>
            {project ? "Save changes" : "Create project"}
          </Button>
        </>
      }
    >
      <form id="project-form" onSubmit={submit} className="space-y-4" noValidate>
        <TextField
          label="Name"
          value={name}
          maxLength={80}
          placeholder="e.g. Support Bot"
          error={errors.name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextAreaField
          label="Description"
          value={description}
          maxLength={500}
          placeholder="What chatbot or API does this project test?"
          error={errors.description}
          hint="Optional"
          onChange={(e) => setDescription(e.target.value)}
        />
        {errors._ && (
          <p role="alert" className="text-sm text-failure">
            {errors._}
          </p>
        )}
      </form>
    </Modal>
  );
}
