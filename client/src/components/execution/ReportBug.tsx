import type { Bug, Execution } from "@testmate/shared";
import { Bug as BugIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { BugFormModal } from "../bugs/BugFormModal";
import { Button } from "../ui/Button";

/** "Report bug" for any result that didn't pass; the form is prefilled from the failed checks. */
export function ReportBug({ execution }: { execution: Execution }) {
  const [open, setOpen] = useState(false);
  const [created, setCreated] = useState<Bug | null>(null);
  if (execution.effectiveStatus === "passed") return null;
  if (created) {
    return (
      <Link to={`/bugs?id=${created.id}`} className="inline-flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs text-success hover:underline">
        <BugIcon className="size-3.5" aria-hidden /> Bug #{created.id} reported
      </Link>
    );
  }
  return (
    <>
      <Button size="sm" variant="ghost" icon={<BugIcon className="size-3.5" aria-hidden />} onClick={() => setOpen(true)}>
        Report bug
      </Button>
      {open && (
        <BugFormModal
          projectId={execution.projectId}
          executionId={execution.id}
          onClose={() => setOpen(false)}
          onCreated={(bug) => {
            setOpen(false);
            setCreated(bug);
          }}
        />
      )}
    </>
  );
}
