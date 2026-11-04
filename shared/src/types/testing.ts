import type { EvaluatorName, ExecutionStatus, ResultSource, TestModule } from "./domain";
import type { MemoryRunDetails } from "./memory";
import type { Intent, LanguageCheckDetails, TestLanguage } from "./multilingual";

export interface TestSuite {
  id: number;
  projectId: number;
  module: TestModule;
  name: string;
  description: string;
  isDemo: boolean;
  /** Test cases (or conversation scripts) currently in the suite. */
  itemCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SuiteInput {
  name: string;
  description?: string;
}

export const MATCH_MODES = ["keywords", "contains", "exact"] as const;
export type MatchMode = (typeof MATCH_MODES)[number];

/** Rule-based criteria for single-turn tests. */
export interface TestCriteria {
  /** keywords: rely on keyword coverage + relevance; contains: expected text must appear; exact: normalized equality. */
  matchMode: MatchMode;
  requiredKeywords: string[];
  forbiddenKeywords: string[];
  /** Minimum token overlap (0-100) between the response and the expected answer. */
  minRelevance: number;
  minLength: number | null;
  maxLength: number | null;
}

export const DEFAULT_CRITERIA: TestCriteria = {
  matchMode: "keywords",
  requiredKeywords: [],
  forbiddenKeywords: [],
  minRelevance: 60,
  minLength: null,
  maxLength: null,
};

export interface TestCase {
  id: number;
  projectId: number;
  suiteId: number | null;
  module: "chatbot" | "multilingual";
  title: string;
  input: string;
  expected: string;
  criteria: TestCriteria;
  inputLanguage: string | null;
  expectedLanguage: string | null;
  expectedIntent: string | null;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
  lastRun: { executionId: number; status: ExecutionStatus; at: string } | null;
}

export interface TestCaseInput {
  suiteId: number | null;
  title: string;
  input: string;
  expected: string;
  criteria: TestCriteria;
  /** Multilingual tests only. */
  inputLanguage?: TestLanguage | null;
  expectedLanguage?: TestLanguage | null;
  expectedIntent?: Intent | null;
}

export type CheckOutcome = "pass" | "review" | "fail" | "skip";

export interface EvaluationCheck {
  id: string;
  label: string;
  outcome: CheckOutcome;
  detail: string;
  /** 0-100 when the check produces a graded score. */
  score?: number;
}

export interface ExecutionDetails {
  checks?: EvaluationCheck[];
  provider?: { name: string; mode?: string };
  /** For simulated runs: which deliberate fault the mock provider injected, if any. */
  simulation?: { faultInjected: string | null };
  /** Memory Lab runs: per-turn transcript and where it first failed. */
  memory?: MemoryRunDetails;
  /** Multilingual Lab runs: detected languages and intent. */
  language?: LanguageCheckDetails;
  /** API Studio runs: the request that was sent (masked) and its outcome. */
  http?: { method: string; url: string; status: number | null; timeMs: number | null; errorKind: string | null };
  [key: string]: unknown;
}

export interface ExecutionOverride {
  status: Exclude<ExecutionStatus, "error">;
  note: string;
  at: string;
}

export interface Execution {
  id: number;
  projectId: number;
  module: TestModule;
  testCaseId: number | null;
  sessionId: number | null;
  apiRequestId: number | null;
  regressionRunId: number | null;
  title: string;
  /** Status assigned by the evaluator. */
  status: ExecutionStatus;
  /** Override status when a human overrode the result, otherwise `status`. */
  effectiveStatus: ExecutionStatus;
  score: number | null;
  source: ResultSource;
  evaluator: EvaluatorName;
  input: string;
  output: string;
  explanation: string;
  details: ExecutionDetails;
  language: string | null;
  durationMs: number | null;
  override: ExecutionOverride | null;
  isDemo: boolean;
  createdAt: string;
}

export interface OverrideInput {
  /** null clears the override. */
  status: Exclude<ExecutionStatus, "error"> | null;
  note?: string;
}

export interface SuiteRunResult {
  suiteId: number;
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
  errors: number;
  executions: Execution[];
}

/** Deliberate faults the mock provider can inject so failing tests can be demonstrated. */
export const MOCK_FAULTS = ["omit_detail", "off_topic", "forbidden_claim", "empty", "wrong_memory", "wrong_language"] as const;
export type MockFault = (typeof MOCK_FAULTS)[number];

export const MOCK_MODES = ["knowledge-base", "echo-expected"] as const;
export type MockMode = (typeof MOCK_MODES)[number];

export interface MockProviderConfig {
  /** knowledge-base: answers from a small built-in support FAQ. echo-expected: returns the expected answer. */
  mode: MockMode;
  /** Share of responses (0-1) that get a deliberate fault. Deterministic per input + seed. */
  failureRate: number;
  faults: MockFault[];
  seed: number;
  /** Number of previous user turns the mock remembers (used by the Memory Lab). */
  memoryWindow: number;
}
