import type { ConversationScript } from "@testmate/shared";
import { Pencil, Play, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { executionsApi } from "../../api/testing";
import { ExecutionResult } from "../../components/execution/ExecutionResult";
import { RunHistory } from "../../components/execution/RunHistory";
import { Badge } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { useAsync } from "../../hooks/useAsync";
import { TURN_KIND_LABELS } from "./turnKinds";

interface Props {
  script: ConversationScript;
  running: boolean;
  onRun: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOverridden: () => void;
}

export function ScriptDetail({ script, running, onRun, onEdit, onDelete, onOverridden }: Props) {
  const load = useCallback(
    () => executionsApi.list(script.projectId, { sessionId: script.id, limit: 20 }),
    [script.projectId, script.id],
  );
  const history = useAsync(load);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const items = history.data?.items ?? [];
  const viewing = items.find((e) => e.id === viewingId) ?? items[0];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{script.title}</h2>
          {script.description && <p className="mt-0.5 text-sm text-muted">{script.description}</p>}
          {script.isDemo && <Badge tone="warning" className="mt-1">Demo data</Badge>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Edit script" icon={<Pencil className="size-3.5" aria-hidden />} onClick={onEdit} />
          <IconButton label="Delete script" className="hover:text-failure" icon={<Trash2 className="size-3.5" aria-hidden />} onClick={onDelete} />
          <Button size="sm" variant="primary" loading={running} icon={<Play className="size-3.5" aria-hidden />} onClick={onRun}>
            Run
          </Button>
        </div>
      </div>

      <details className="mt-4 rounded-xl border border-line" open={!viewing}>
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-muted hover:text-fg">
          Script · {script.turns.length} turns
        </summary>
        <ol className="space-y-2 border-t border-line p-3">
          {script.turns.map((t) => {
            const e = t.expectation;
            return (
              <li key={t.position} className="text-sm">
                <div className="flex items-start gap-2">
                  <span className="w-5 shrink-0 text-xs text-muted tabular-nums">{t.position}.</span>
                  <div className="min-w-0 flex-1">
                    <p>{t.userMessage}</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <Badge>{TURN_KIND_LABELS[e.kind]}</Badge>
                      {e.mustInclude.map((k) => <Badge key={`i-${k}`} tone="success">+ {k}</Badge>)}
                      {e.mustIncludeAny.length > 0 && <Badge tone="success">any of: {e.mustIncludeAny.join(" / ")}</Badge>}
                      {e.mustNotInclude.map((k) => <Badge key={`n-${k}`} tone="failure">− {k}</Badge>)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </details>

      <div className="mt-5 border-t border-line pt-5">
        {history.loading ? (
          <LoadingState label="Loading results…" />
        ) : history.error ? (
          <ErrorState message={history.error.message} onRetry={history.reload} />
        ) : !viewing ? (
          <EmptyState title="Not run yet" description="Run the script to see each turn and where memory breaks." />
        ) : (
          <>
            {viewing.id !== items[0]?.id && (
              <p className="mb-3 text-xs text-warning">Viewing an older run. The latest run is at the top of the history.</p>
            )}
            <ExecutionResult
              execution={viewing}
              onChanged={() => {
                history.refresh();
                onOverridden();
              }}
            />
          </>
        )}
      </div>

      <RunHistory
        items={items}
        total={history.data?.total ?? 0}
        viewingId={viewing?.id}
        onView={setViewingId}
        describe={(e) => {
          const turn = e.details.memory?.firstFailureTurn;
          return turn ? `turn ${turn}` : null;
        }}
      />
    </Card>
  );
}
