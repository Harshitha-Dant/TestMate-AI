import type { BugSeverity, BugStatus, ExecutionStatus, TestModule } from "./domain";
import type { Execution } from "./testing";

// ---------- Regression ----------

/**
 * new_failure: passed before, failed/error now. fixed: not passing before, passing now.
 * changed: any other status change (e.g. passed → needs review). new_test: not in the baseline.
 */
export const REGRESSION_CHANGES = ["new_failure", "fixed", "changed", "new_test", "unchanged"] as const;
export type RegressionChange = (typeof REGRESSION_CHANGES)[number];

export interface RegressionRunSummary {
  id: number;
  projectId: number;
  suiteId: number | null;
  suiteName: string;
  module: TestModule | null;
  baselineRunId: number | null;
  label: string;
  total: number;
  passed: number;
  failed: number;
  needsReview: number;
  errors: number;
  /** 0-100, one decimal. */
  passRate: number;
  baselinePassRate: number | null;
  /** passRate - baselinePassRate, in percentage points. */
  passRateDelta: number | null;
  newFailures: number;
  fixed: number;
  isDemo: boolean;
  createdAt: string;
}

export interface RegressionResultRow {
  /** Stable item identity across runs: case:<id>, script:<id> or api:<savedRequestId>. */
  itemKey: string;
  title: string;
  status: ExecutionStatus;
  previousStatus: ExecutionStatus | null;
  change: RegressionChange;
  executionId: number | null;
  previousExecutionId: number | null;
}

export interface RemovedItem {
  itemKey: string;
  title: string;
  previousStatus: ExecutionStatus;
  previousExecutionId: number | null;
}

export interface RegressionDiff {
  from: RegressionRunSummary | null;
  to: RegressionRunSummary;
  results: RegressionResultRow[];
  removed: RemovedItem[];
  counts: Record<RegressionChange, number> & { removed: number };
}

export interface RegressionRunInput {
  suiteId: number;
  label?: string;
  /** Defaults to the suite's most recent run. */
  baselineRunId?: number | null;
  /** Open a bug for every newly introduced failure (skipped when an open bug already tracks that test). */
  createBugs?: boolean;
}

export interface RegressionRunResponse {
  diff: RegressionDiff;
  bugsCreated: number[];
}

// ---------- Bugs ----------

export const BUG_CATEGORIES = [
  "regression",
  "wrong_answer",
  "context_loss",
  "wrong_memory",
  "wrong_language",
  "api_failure",
  "performance",
  "security",
  "other",
] as const;
export type BugCategory = (typeof BUG_CATEGORIES)[number];

export const BUG_CATEGORY_LABELS: Record<BugCategory, string> = {
  regression: "Regression",
  wrong_answer: "Wrong / incomplete answer",
  context_loss: "Context loss",
  wrong_memory: "Wrong memory / contradiction",
  wrong_language: "Wrong language",
  api_failure: "API failure",
  performance: "Performance",
  security: "Security",
  other: "Other",
};

export const BUG_SEVERITY_LABELS: Record<BugSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const BUG_STATUS_LABELS: Record<BugStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

export interface Bug {
  id: number;
  projectId: number;
  executionId: number | null;
  regressionRunId: number | null;
  itemKey: string | null;
  title: string;
  module: TestModule | null;
  category: BugCategory;
  severity: BugSeverity;
  status: BugStatus;
  failureExplanation: string;
  notes: string;
  isDemo: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BugHistoryEntry {
  id: number;
  action: "created" | "updated" | "commented";
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  note: string | null;
  createdAt: string;
}

export interface BugDetail extends Bug {
  history: BugHistoryEntry[];
  execution: Execution | null;
}

export interface BugInput {
  title: string;
  module: TestModule | null;
  category: BugCategory;
  severity: BugSeverity;
  failureExplanation: string;
  notes: string;
  executionId?: number | null;
}

export interface BugUpdate {
  title?: string;
  category?: BugCategory;
  severity?: BugSeverity;
  status?: BugStatus;
  notes?: string;
  /** Optional comment recorded with the change. */
  comment?: string;
}

export interface BugSummary {
  total: number;
  byStatus: Record<BugStatus, number>;
  /** Open and in-progress bugs only. */
  openBySeverity: Record<BugSeverity, number>;
}
