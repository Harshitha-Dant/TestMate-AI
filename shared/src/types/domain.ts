/** Shared enums and constants. Keep these in sync with CHECK constraints in server/src/db/migrations. */

export const TEST_MODULES = ["chatbot", "memory", "multilingual", "api"] as const;
export type TestModule = (typeof TEST_MODULES)[number];

export const EXECUTION_STATUSES = ["passed", "failed", "needs_review", "error"] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

/** Where a chatbot response came from. "mock" results must always be labeled as simulated in the UI. */
export const RESULT_SOURCES = ["mock", "live"] as const;
export type ResultSource = (typeof RESULT_SOURCES)[number];

export const EVALUATORS = ["rule-based"] as const;
export type EvaluatorName = (typeof EVALUATORS)[number];

export const LANGUAGES = ["en", "te", "te-Latn", "hi", "hi-Latn", "mixed", "unknown"] as const;
export type Language = (typeof LANGUAGES)[number];

export const BUG_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type BugSeverity = (typeof BUG_SEVERITIES)[number];

export const BUG_STATUSES = ["open", "in_progress", "resolved", "wont_fix"] as const;
export type BugStatus = (typeof BUG_STATUSES)[number];

export const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];
