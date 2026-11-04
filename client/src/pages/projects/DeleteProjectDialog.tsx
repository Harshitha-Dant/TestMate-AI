import { useState } from "react";
import type { ProjectWithStats } from "@testmate/shared";
import { errorMessage } from "../../api/client";
import { projectsApi } from "../../api/projects";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";

interface Props {
  project: ProjectWithStats | null;
  onClose: () => void;
  onDeleted: (id: number) => void;
}

/** Deletion cascades to every suite, test, run and bug in the project, so the user must type its name. */
export function DeleteProjectDialog({ project, onClose, onDeleted }: Props) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string>();
  const [deleting, setDeleting] = useState(false);

  if (!project) return null;
  const { stats } = project;
  const matches = typed.trim() === project.name;

  async function confirm() {
    if (!project || !matches) return;
    setDeleting(true);
    setError(undefined);
    try {
      await projectsApi.remove(project.id);
      onDeleted(project.id);
    } catch (err) {
      setError(errorMessage(err));
      setDeleting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete project"
      description={
        <>
          This permanently deletes <span className="text-fg">{project.name}</span> and everything in it:{" "}
          {stats.suites} suites, {stats.testCases} tests, {stats.executions} runs and {stats.openBugs} open bugs. This
          can't be undone.
        </>
      }
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirm} disabled={!matches} loading={deleting}>
            Delete project
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void confirm();
        }}
      >
        <TextField
          label={`Type "${project.name}" to confirm`}
          value={typed}
          autoComplete="off"
          onChange={(e) => setTyped(e.target.value)}
          error={error}
        />
      </form>
    </Modal>
  );
}
