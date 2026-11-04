import type { Execution } from "@testmate/shared";
import { FlaskConical } from "lucide-react";
import { faultLabel } from "../../lib/faults";
import { formatDateTime, formatDuration } from "../../lib/format";
import { langAttr } from "../../lib/languages";
import { SourceBadge, StatusBadge } from "../ui/StatusBadge";
import { CheckList } from "./CheckList";
import { ConversationTranscript } from "./ConversationTranscript";
import { LanguagePanel } from "./LanguagePanel";
import { OverridePanel } from "./OverridePanel";
import { ReportBug } from "./ReportBug";

/**
 * Full view of one execution: verdict, simulated-output labeling, then either the single reply with its
 * checks or (for Memory Lab runs) the turn-by-turn transcript, and the manual override.
 */
export function ExecutionResult({ execution, onChanged }: { execution: Execution; onChanged: (e: Execution) => void }) {
  const memory = execution.details.memory;
  const fault = memory ? null : execution.details.simulation?.faultInjected;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={execution.effectiveStatus} overridden={!!execution.override} />
        <SourceBadge source={execution.source} />
        {execution.score !== null && (
          <span className="text-xs tabular-nums text-muted" title={memory ? "Share of turns that passed" : undefined}>
            Score {execution.score}
          </span>
        )}
        <span className="text-xs text-muted">· {formatDuration(execution.durationMs)}</span>
        <span className="ml-auto text-xs text-muted">{formatDateTime(execution.createdAt)}</span>
      </div>

      {fault && (
        <p className="flex gap-2 rounded-xl border border-accent/20 bg-accent/5 px-3 py-2 text-xs text-muted">
          <FlaskConical className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
          <span>
            Deliberate fault injected by the simulated bot: it {faultLabel(fault)}. Change this in Simulated bot settings.
          </span>
        </p>
      )}

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Why</p>
        <p className="text-sm">{execution.explanation}</p>
      </div>

      {memory ? (
        <ConversationTranscript memory={memory} source={execution.source} />
      ) : (
        <>
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted">
              {execution.source === "mock" ? "Simulated response (mock provider, not a real AI)" : "Chatbot response"}
            </p>
            <div
              className="rounded-xl border border-line bg-bg/50 px-3 py-2.5 text-sm whitespace-pre-wrap"
              lang={langAttr(execution.details.language?.output.language)}
            >
              {execution.output || <span className="text-muted italic">(empty response)</span>}
            </div>
          </div>
          {execution.details.language && <LanguagePanel language={execution.details.language} />}
          {execution.details.checks && execution.details.checks.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-muted">Rule-based checks</p>
              <CheckList checks={execution.details.checks} />
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <OverridePanel key={execution.id} execution={execution} onChanged={onChanged} />
        </div>
        <ReportBug key={`bug-${execution.id}`} execution={execution} />
      </div>
    </div>
  );
}
