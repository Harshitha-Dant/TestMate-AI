import type {
  CheckOutcome,
  EvaluationCheck,
  ExecutionStatus,
  MemoryRunDetails,
  TurnExpectation,
  TurnIssue,
  TurnResult,
} from "@testmate/shared";
import { extractBotFacts, extractUserFacts, sameValue, signalsForgetting } from "../lib/conversationFacts";
import { containsPhrase, normalize } from "../lib/text";

export interface PlayedTurn {
  position: number;
  userMessage: string;
  reply: string;
  expectation: TurnExpectation;
  visibleTurns: number[] | null;
  faultInjected: string | null;
}

export interface ConversationEvaluation {
  status: Exclude<ExecutionStatus, "error">;
  score: number;
  explanation: string;
  details: MemoryRunDetails;
}

const ISSUE_LABELS: Record<TurnIssue["type"], string> = {
  context_loss: "context loss",
  wrong_memory: "wrong memory",
  contradiction: "contradiction",
  follow_up_invalid: "invalid follow-up",
  missing_info: "missing info",
  empty_reply: "empty reply",
};

const RANK: Record<CheckOutcome, number> = { skip: 0, pass: 1, review: 2, fail: 3 };
const quote = (items: string[]) => items.map((i) => `"${i}"`).join(", ");

/**
 * Rule-based multi-turn evaluator. Per turn it checks the expected recall / follow-up / forbidden terms,
 * and across turns it compares what the bot asserts ("your name is X") with what the user said, to flag
 * contradictions and use of outdated facts. Fact detection is English-pattern based (see conversationFacts).
 */
export class ConversationEvaluator {
  readonly name = "rule-based" as const;

  evaluate(turns: PlayedTurn[], memoryWindow: number | null): ConversationEvaluation {
    /** Every value the user gave per slot, in order. */
    const userFacts = new Map<string, { value: string; turn: number }[]>();
    /** The bot's own earlier assertions per slot. */
    const botFacts = new Map<string, { value: string; turn: number }>();
    const transcript: TurnResult[] = [];

    for (const turn of turns) {
      for (const f of extractUserFacts(turn.userMessage)) {
        userFacts.set(f.slot, [...(userFacts.get(f.slot) ?? []), { value: f.value, turn: turn.position }]);
      }
      const checks: EvaluationCheck[] = [];
      const issues: TurnIssue[] = [];
      const add = (check: EvaluationCheck, issue?: TurnIssue) => {
        checks.push(check);
        if (issue && check.outcome !== "pass" && check.outcome !== "skip") issues.push(issue);
      };

      const empty = normalize(turn.reply) === "";
      add(
        { id: "reply", label: "Reply present", outcome: empty ? "fail" : "pass", detail: empty ? "The bot returned an empty reply." : "Reply received." },
        { type: "empty_reply", detail: "The bot returned an empty reply." },
      );

      const { kind, mustInclude, mustIncludeAny, mustNotInclude } = turn.expectation;

      if (mustInclude.length) {
        const missing = mustInclude.filter((k) => !containsPhrase(turn.reply, k));
        const outcome: CheckOutcome = missing.length === 0 ? "pass" : missing.length < mustInclude.length ? "review" : "fail";
        const label = kind === "recall" ? "Recalls earlier facts" : "Includes expected details";
        // A recall that asserts some other value is wrong memory; one that just lacks the fact is context loss.
        const asserted = kind === "recall" && !signalsForgetting(turn.reply) ? extractBotFacts(turn.reply) : [];
        let issue: TurnIssue;
        if (missing.length === 0) issue = { type: "missing_info", detail: `Mentions ${quote(mustInclude)}.` };
        else if (kind !== "recall") issue = { type: "missing_info", detail: `Missing expected details: ${quote(missing)}.` };
        else if (asserted.length)
          issue = {
            type: "wrong_memory",
            detail: `Expected ${quote(missing)}, but the bot answered with ${quote(asserted.map((a) => a.value))}.`,
          };
        else issue = { type: "context_loss", detail: contextLossDetail(turn, missing, memoryWindow) };
        add({ id: "include", label, outcome, detail: issue.detail }, issue);
      }

      if (mustIncludeAny.length) {
        const found = mustIncludeAny.some((k) => containsPhrase(turn.reply, k));
        const detail = found
          ? "The reply stays on the earlier topic."
          : `The reply doesn't address the follow-up: none of ${quote(mustIncludeAny)} appear${
              signalsForgetting(turn.reply) ? ", and the bot seems to have lost the previous turn's topic" : ""
            }.`;
        add(
          { id: "follow_up", label: "Valid follow-up answer", outcome: found ? "pass" : "fail", detail },
          { type: "follow_up_invalid", detail },
        );
      }

      if (mustNotInclude.length) {
        const found = mustNotInclude.filter((k) => containsPhrase(turn.reply, k));
        const detail = found.length ? `Used wrong information: mentions ${quote(found)}.` : "No wrong information used.";
        add(
          { id: "forbidden", label: "No wrong memory", outcome: found.length ? "fail" : "pass", detail },
          { type: "wrong_memory", detail },
        );
      }

      // Cross-turn consistency: compare what the bot asserts with what the user said earlier.
      const consistency: TurnIssue[] = [];
      for (const fact of extractBotFacts(turn.reply)) {
        const history = userFacts.get(fact.slot) ?? [];
        const latest = history[history.length - 1];
        if (latest && !sameValue(latest.value, fact.value)) {
          const stale = history.find((h) => sameValue(h.value, fact.value));
          consistency.push(
            stale
              ? {
                  type: "wrong_memory",
                  detail: `Used an outdated ${fact.slot}: "${fact.value}" (turn ${stale.turn}) was updated to "${latest.value}" at turn ${latest.turn}.`,
                }
              : {
                  type: "contradiction",
                  detail: `Says the ${fact.slot} is "${fact.value}", but the user said "${latest.value}" at turn ${latest.turn}.`,
                },
          );
        } else if (!latest) {
          const earlier = botFacts.get(fact.slot);
          if (earlier && !sameValue(earlier.value, fact.value)) {
            consistency.push({
              type: "contradiction",
              detail: `Contradicts itself: said the ${fact.slot} is "${earlier.value}" at turn ${earlier.turn}, now "${fact.value}".`,
            });
          }
        }
        botFacts.set(fact.slot, { value: fact.value, turn: turn.position });
      }
      checks.push({
        id: "consistency",
        label: "Consistent with earlier turns",
        outcome: consistency.length ? "fail" : "pass",
        detail: consistency.length ? consistency.map((c) => c.detail).join(" ") : "No contradictions with earlier turns.",
      });
      issues.push(...consistency);

      const worst = checks.reduce<CheckOutcome>((a, c) => (RANK[c.outcome] > RANK[a] ? c.outcome : a), "skip");
      transcript.push({
        position: turn.position,
        userMessage: turn.userMessage,
        reply: turn.reply,
        status: worst === "fail" ? "failed" : worst === "review" ? "needs_review" : "passed",
        issues,
        checks,
        visibleTurns: turn.visibleTurns,
        faultInjected: turn.faultInjected,
      });
    }

    const failedTurns = transcript.filter((t) => t.status === "failed");
    const reviewTurns = transcript.filter((t) => t.status === "needs_review");
    const status = failedTurns.length ? "failed" : reviewTurns.length ? "needs_review" : "passed";
    const firstFailure = transcript.find((t) => t.status !== "passed") ?? null;
    const passed = transcript.length - failedTurns.length - reviewTurns.length;

    const facts: MemoryRunDetails["facts"] = {};
    for (const [slot, history] of userFacts) {
      const latest = history[history.length - 1]!;
      facts[slot] = { value: latest.value, turn: latest.turn };
    }

    return {
      status,
      score: transcript.length ? Math.round((passed / transcript.length) * 100) : 0,
      explanation: firstFailure
        ? `First problem at turn ${firstFailure.position}${
            firstFailure.issues[0] ? ` (${ISSUE_LABELS[firstFailure.issues[0].type]})` : ""
          }: ${firstFailure.issues[0]?.detail ?? "a check did not pass."}` +
          (failedTurns.length + reviewTurns.length > 1
            ? ` ${failedTurns.length + reviewTurns.length} of ${transcript.length} turns have problems.`
            : "")
        : `All ${transcript.length} turns passed.`,
      details: { transcript, firstFailureTurn: firstFailure?.position ?? null, memoryWindow, facts },
    };
  }
}

function contextLossDetail(turn: PlayedTurn, missing: string[], memoryWindow: number | null): string {
  const forgot = signalsForgetting(turn.reply);
  const base = forgot
    ? `The bot no longer remembers ${quote(missing)}.`
    : `Expected the bot to recall ${quote(missing)}, but the reply doesn't mention it.`;
  if (memoryWindow === null || !turn.visibleTurns) return base;
  const seen = turn.visibleTurns;
  return seen.length
    ? `${base} With a memory window of ${memoryWindow}, it could only see ${turnRange(seen)}.`
    : `${base} The memory window is ${memoryWindow}, so it saw no earlier turns.`;
}

export function turnRange(turns: number[]): string {
  const first = turns[0];
  const last = turns[turns.length - 1];
  return first === last ? `turn ${first}` : `turns ${first}–${last}`;
}
