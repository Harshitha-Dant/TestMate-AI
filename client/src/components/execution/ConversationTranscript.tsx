import type { MemoryIssueType, MemoryRunDetails, ResultSource, TurnResult } from "@testmate/shared";
import { Bot, ChevronDown, Eye, FlaskConical, User } from "lucide-react";
import { useRef } from "react";
import { cn } from "../../lib/cn";
import { faultLabel } from "../../lib/faults";
import { Badge } from "../ui/Badge";
import { StatusBadge } from "../ui/StatusBadge";
import { CheckList } from "./CheckList";

const ISSUE_LABELS: Record<MemoryIssueType, string> = {
  context_loss: "Context loss",
  wrong_memory: "Wrong memory",
  contradiction: "Contradiction",
  follow_up_invalid: "Invalid follow-up",
  missing_info: "Missing info",
  empty_reply: "Empty reply",
};

const DOT: Record<TurnResult["status"], string> = {
  passed: "bg-success/80",
  failed: "bg-failure",
  needs_review: "bg-warning",
};

function windowText(turn: TurnResult): string | null {
  const seen = turn.visibleTurns;
  if (!seen || turn.position === 1) return null;
  if (seen.length === 0) return "Bot could see no earlier turns";
  const missed = turn.position - 1 - seen.length;
  const range = seen.length === 1 ? `turn ${seen[0]}` : `turns ${seen[0]}–${seen[seen.length - 1]}`;
  return `Bot could see ${range}${missed > 0 ? ` (forgot ${missed})` : ""}`;
}

/** Turn-by-turn view of a Memory Lab run, with the first failing turn highlighted. */
export function ConversationTranscript({ memory, source }: { memory: MemoryRunDetails; source: ResultSource }) {
  const listRef = useRef<HTMLOListElement>(null);
  const jump = (position: number) =>
    listRef.current?.querySelector(`[data-turn="${position}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  const facts = Object.entries(memory.facts);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1" role="list" aria-label="Turn results">
          {memory.transcript.map((t) => (
            <button
              key={t.position}
              type="button"
              role="listitem"
              title={`Turn ${t.position}: ${t.status.replace("_", " ")}`}
              onClick={() => jump(t.position)}
              className={cn(
                "grid size-6 place-items-center rounded-md text-[10px] font-semibold text-bg tabular-nums transition-transform hover:scale-110",
                DOT[t.status],
                t.position === memory.firstFailureTurn && "ring-2 ring-fg/80 ring-offset-2 ring-offset-card",
              )}
            >
              {t.position}
            </button>
          ))}
        </div>
        {memory.memoryWindow !== null && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <Eye className="size-3.5" aria-hidden /> Memory window: {memory.memoryWindow} {memory.memoryWindow === 1 ? "turn" : "turns"}
          </span>
        )}
      </div>

      {facts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-xs text-muted">Facts the user gave:</span>
          {facts.map(([slot, f]) => (
            <Badge key={slot}>
              {slot}: <span className="text-fg">{f.value}</span> <span className="opacity-60">(turn {f.turn})</span>
            </Badge>
          ))}
        </div>
      )}

      <ol ref={listRef} className="space-y-3">
        {memory.transcript.map((t) => {
          const isFirstFailure = t.position === memory.firstFailureTurn;
          const seen = windowText(t);
          return (
            <li
              key={t.position}
              data-turn={t.position}
              className={cn(
                "rounded-xl border p-3 transition-colors",
                isFirstFailure ? "border-failure/40 bg-failure/[0.04]" : "border-line",
              )}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-muted">Turn {t.position}</span>
                <StatusBadge status={t.status} />
                {isFirstFailure && <Badge tone="failure">First failure</Badge>}
                {seen && <span className="ml-auto text-[11px] text-muted">{seen}</span>}
              </div>

              <div className="space-y-2">
                <div className="flex justify-end gap-2">
                  <p className="max-w-[85%] rounded-2xl rounded-tr-sm bg-card-2 px-3 py-2 text-sm">{t.userMessage}</p>
                  <User className="mt-2 size-4 shrink-0 text-muted" aria-label="User" />
                </div>
                <div className="flex gap-2">
                  <Bot className="mt-2 size-4 shrink-0 text-accent" aria-label={source === "mock" ? "Simulated bot" : "Chatbot"} />
                  <div className="max-w-[85%] rounded-2xl rounded-tl-sm border border-line bg-bg/50 px-3 py-2 text-sm">
                    {t.reply || <span className="text-muted italic">(empty reply)</span>}
                    {source === "mock" && (
                      <span className="mt-1 block text-[10px] tracking-wide text-accent/80 uppercase">Simulated</span>
                    )}
                  </div>
                </div>
              </div>

              {t.faultInjected && (
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
                  <FlaskConical className="size-3 text-accent" aria-hidden /> Deliberate fault: the bot {faultLabel(t.faultInjected)}.
                </p>
              )}

              {t.issues.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {t.issues.map((issue, i) => (
                    <li key={i} className={cn("text-xs", t.status === "failed" ? "text-failure" : "text-warning")}>
                      <span className="font-semibold">{ISSUE_LABELS[issue.type]}:</span> {issue.detail}
                    </li>
                  ))}
                </ul>
              )}

              <details className="group mt-2">
                <summary className="flex cursor-pointer list-none items-center gap-1 text-[11px] text-muted hover:text-fg">
                  <ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden /> Checks
                </summary>
                <div className="mt-2">
                  <CheckList checks={t.checks} />
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
