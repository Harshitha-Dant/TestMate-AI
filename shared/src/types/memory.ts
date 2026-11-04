import type { ExecutionStatus } from "./domain";
import type { EvaluationCheck } from "./testing";

/**
 * statement: the user gives information (the reply only needs to be present, optionally acknowledging it).
 * recall: the bot must bring back earlier facts.
 * follow_up: the question only makes sense with the previous turn's context.
 */
export const TURN_KINDS = ["statement", "recall", "follow_up"] as const;
export type TurnKind = (typeof TURN_KINDS)[number];

export interface TurnExpectation {
  kind: TurnKind;
  /** All must appear in the reply (e.g. the recalled name). */
  mustInclude: string[];
  /** At least one must appear (follow-up topic words). */
  mustIncludeAny: string[];
  /** None may appear (e.g. an outdated city, another customer's name). */
  mustNotInclude: string[];
}

export interface ConversationTurn {
  position: number;
  userMessage: string;
  expectation: TurnExpectation;
}

export interface ConversationScript {
  id: number;
  projectId: number;
  suiteId: number | null;
  title: string;
  description: string;
  turns: ConversationTurn[];
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: { executionId: number; status: ExecutionStatus; at: string; firstFailureTurn: number | null } | null;
}

export interface ConversationScriptInput {
  suiteId: number | null;
  title: string;
  description: string;
  turns: { userMessage: string; expectation: TurnExpectation }[];
}

export const MEMORY_ISSUES = [
  "context_loss",
  "wrong_memory",
  "contradiction",
  "follow_up_invalid",
  "missing_info",
  "empty_reply",
] as const;
export type MemoryIssueType = (typeof MEMORY_ISSUES)[number];

export interface TurnIssue {
  type: MemoryIssueType;
  detail: string;
}

export interface TurnResult {
  position: number;
  userMessage: string;
  reply: string;
  status: Exclude<ExecutionStatus, "error">;
  issues: TurnIssue[];
  checks: EvaluationCheck[];
  /** Earlier turn positions the chatbot could still see when answering (simulated memory window). */
  visibleTurns: number[] | null;
  faultInjected: string | null;
}

export interface MemoryRunDetails {
  transcript: TurnResult[];
  /** Position of the first turn that did not pass, or null when every turn passed. */
  firstFailureTurn: number | null;
  memoryWindow: number | null;
  /** Facts the user stated, by slot, with the turn where the latest value was given. */
  facts: Record<string, { value: string; turn: number }>;
}
