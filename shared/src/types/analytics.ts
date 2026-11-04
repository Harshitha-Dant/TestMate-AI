import type { ExecutionStatus, ResultSource, TestModule } from "./domain";
import type { MemoryIssueType } from "./memory";
import type { LanguageSummaryRow, TestLanguage } from "./multilingual";
import type { BugSummary, RegressionRunSummary } from "./quality";

/** Weights of each module in the AI Quality Score, renormalized over modules that have results. */
export const QUALITY_WEIGHTS: Record<TestModule, number> = { chatbot: 0.5, memory: 0.2, multilingual: 0.15, api: 0.15 };

export const QUALITY_FORMULA =
  "Quality score = weighted average of each module's pass rate over the latest result of every test " +
  "(passed = 100%, needs review = 50%, failed/error = 0%). Weights: Chatbot 50%, Memory 20%, Multilingual 15%, " +
  "API 15%. Modules without results are left out and the remaining weights are scaled to add up to 100%.";

export interface ModuleStat {
  module: TestModule;
  /** Distinct tests with a result (latest result per test). */
  tests: number;
  passed: number;
  failed: number;
  needsReview: number;
  errors: number;
  /** Quality-weighted pass rate (needs review counts half), 0-100, or null without results. */
  passRate: number | null;
  avgScore: number | null;
}

export interface QualityScore {
  score: number | null;
  components: { module: TestModule; weight: number; passRate: number }[];
}

export interface TrendPoint {
  /** YYYY-MM-DD (UTC). */
  date: string;
  passed: number;
  failed: number;
  needsReview: number;
  errors: number;
}

export interface RecentRun {
  id: number;
  title: string;
  module: TestModule;
  status: ExecutionStatus;
  source: ResultSource;
  score: number | null;
  createdAt: string;
}

export interface Analytics {
  /** null days = all time. */
  range: { days: number | null; from: string | null };
  totals: { executions: number; passed: number; failed: number; needsReview: number; errors: number; mock: number; live: number };
  quality: QualityScore;
  modules: ModuleStat[];
  trend: TrendPoint[];
  recent: RecentRun[];
  chatbot: { tests: number; avgScore: number | null; topFailingChecks: { label: string; count: number }[] };
  memory: {
    scripts: number;
    passRate: number | null;
    issues: Record<MemoryIssueType, number>;
    avgFirstFailureTurn: number | null;
  };
  api: {
    requests: number;
    passRate: number | null;
    errors: number;
    blocked: number;
    avgMs: number | null;
    p95Ms: number | null;
    maxMs: number | null;
    errorKinds: Record<string, number>;
    slowest: { endpoint: string; avgMs: number; count: number }[];
  };
  languages: LanguageSummaryRow[];
  regression: RegressionRunSummary[];
  bugs: BugSummary;
}

export interface ExecutionListFilter {
  module?: TestModule;
  status?: ExecutionStatus;
  source?: ResultSource;
  q?: string;
  days?: number;
  limit?: number;
  offset?: number;
}

export type ThemePreference = "dark" | "light" | "system";

/** App-wide preferences (stored server-side; theme is per browser). */
export interface Preferences {
  defaultInputLanguage: TestLanguage;
  defaultExpectedLanguage: TestLanguage;
  /** Default minimum relevance (0-100) for new chatbot/multilingual tests. */
  defaultMinRelevance: number;
  /** Quality score at or above this is shown as healthy on the dashboard. */
  qualityTarget: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  defaultInputLanguage: "te",
  defaultExpectedLanguage: "te",
  defaultMinRelevance: 60,
  qualityTarget: 80,
};
