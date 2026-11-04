import {
  BUG_CATEGORIES,
  BUG_CATEGORY_LABELS,
  BUG_SEVERITIES,
  BUG_SEVERITY_LABELS,
  BUG_STATUSES,
  BUG_STATUS_LABELS,
  type BugCategory,
  type BugDetail,
  type BugHistoryEntry,
  type BugSeverity,
  type BugStatus,
  type BugUpdate,
} from "@testmate/shared";
import { Eye, MessageSquare, Trash2 } from "lucide-react";
import { useState } from "react";
import { errorMessage } from "../../api/client";
import { bugsApi } from "../../api/quality";
import { Badge } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { TextAreaField } from "../../components/ui/Field";
import { SelectField } from "../../components/ui/SelectField";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { formatDateTime } from "../../lib/format";

interface Props {
  bug: BugDetail;
  onChanged: (bug: BugDetail) => void;
  onDelete: () => void;
  onViewExecution: (id: number) => void;
}

const FIELD_LABELS: Record<string, string> = { status: "Status", severity: "Severity", category: "Category", title: "Title", notes: "Notes" };

function describeValue(field: string | null, value: string | null): string {
  if (value === null) return "";
  if (field === "status") return BUG_STATUS_LABELS[value as BugStatus] ?? value;
  if (field === "severity") return BUG_SEVERITY_LABELS[value as BugSeverity] ?? value;
  if (field === "category") return BUG_CATEGORY_LABELS[value as BugCategory] ?? value;
  return value;
}

function HistoryItem({ h }: { h: BugHistoryEntry }) {
  let text: string;
  if (h.action === "created") text = "Bug opened";
  else if (h.action === "commented") text = "Comment";
  else if (h.field === "notes") text = "Notes edited";
  else text = `${FIELD_LABELS[h.field ?? ""] ?? h.field}: ${describeValue(h.field, h.oldValue)} → ${describeValue(h.field, h.newValue)}`;
  return (
    <li className="relative pl-5">
      <span className="absolute top-1.5 left-0 size-2 rounded-full bg-accent/70" aria-hidden />
      <p className="text-sm">{text}</p>
      {h.note && <p className="mt-0.5 text-sm text-muted">“{h.note}”</p>}
      <p className="text-[11px] text-muted/70">{formatDateTime(h.createdAt)}</p>
    </li>
  );
}

/** Bug detail: change status/severity/category (each change is logged), edit notes, comment, see the linked result. */
export function BugDetailPanel({ bug, onChanged, onDelete, onViewExecution }: Props) {
  const [notes, setNotes] = useState(bug.notes);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  async function save(update: BugUpdate, key: string) {
    setSaving(key);
    setError(undefined);
    try {
      onChanged(await bugsApi.update(bug.projectId, bug.id, update));
      if (key === "comment") setComment("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(null);
    }
  }

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">Bug #{bug.id}{bug.isDemo ? " · demo data" : ""}</p>
          <h2 className="mt-0.5 text-base font-semibold">{bug.title}</h2>
          <p className="mt-1 text-xs text-muted">
            Opened {formatDateTime(bug.createdAt)} · updated {formatDateTime(bug.updatedAt)}
          </p>
        </div>
        <IconButton label="Delete bug" className="hover:text-failure" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={onDelete} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <SelectField
          label="Status"
          value={bug.status}
          disabled={saving !== null}
          onChange={(e) => save({ status: e.target.value as BugStatus }, "status")}
          options={BUG_STATUSES.map((s) => ({ value: s, label: BUG_STATUS_LABELS[s] }))}
        />
        <SelectField
          label="Severity"
          value={bug.severity}
          disabled={saving !== null}
          onChange={(e) => save({ severity: e.target.value as BugSeverity }, "severity")}
          options={BUG_SEVERITIES.map((s) => ({ value: s, label: BUG_SEVERITY_LABELS[s] }))}
        />
        <SelectField
          label="Category"
          value={bug.category}
          disabled={saving !== null}
          onChange={(e) => save({ category: e.target.value as BugCategory }, "category")}
          options={BUG_CATEGORIES.map((c) => ({ value: c, label: BUG_CATEGORY_LABELS[c] }))}
        />
      </div>
      {error && <p className="mt-2 text-sm text-failure">{error}</p>}

      <div className="mt-5">
        <p className="mb-1.5 text-xs font-medium text-muted">Failure explanation</p>
        <p className="text-sm whitespace-pre-wrap">{bug.failureExplanation || <span className="text-muted">None given.</span>}</p>
      </div>

      {bug.execution && (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line px-3 py-2.5">
          <span className="text-xs text-muted">Linked result:</span>
          <span className="min-w-0 truncate text-sm">{bug.execution.title}</span>
          <StatusBadge status={bug.execution.effectiveStatus} />
          {bug.execution.source === "mock" && <Badge tone="accent">Simulated</Badge>}
          <Button size="sm" variant="ghost" className="ml-auto" icon={<Eye className="size-3.5" aria-hidden />} onClick={() => onViewExecution(bug.execution!.id)}>
            View result
          </Button>
        </div>
      )}
      {!bug.execution && bug.executionId && <p className="mt-4 text-xs text-muted">The linked result was deleted.</p>}

      <div className="mt-5 space-y-2">
        <TextAreaField label="Notes" value={notes} maxLength={5000} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end">
          <Button size="sm" disabled={notes === bug.notes} loading={saving === "notes"} onClick={() => save({ notes }, "notes")}>
            Save notes
          </Button>
        </div>
      </div>

      <div className="mt-5 border-t border-line pt-5">
        <p className="mb-3 text-xs font-medium text-muted">History</p>
        <ol className="space-y-3 border-l border-line pl-1">
          {bug.history.map((h) => (
            <HistoryItem key={h.id} h={h} />
          ))}
        </ol>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (comment.trim()) void save({ comment }, "comment");
          }}
        >
          <label htmlFor="bug-comment" className="sr-only">
            Add a comment
          </label>
          <input
            id="bug-comment"
            value={comment}
            maxLength={2000}
            placeholder="Add a comment…"
            onChange={(e) => setComment(e.target.value)}
            className="h-9 min-w-0 flex-1 rounded-xl border border-line-strong bg-bg/60 px-3 text-sm placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
          />
          <Button size="sm" type="submit" disabled={!comment.trim()} loading={saving === "comment"} icon={<MessageSquare className="size-3.5" aria-hidden />}>
            Comment
          </Button>
        </form>
      </div>
    </Card>
  );
}
