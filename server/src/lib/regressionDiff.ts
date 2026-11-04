import type { ExecutionStatus, RegressionChange, RegressionResultRow, RemovedItem } from "@testmate/shared";

export interface RunItem {
  itemKey: string;
  title: string;
  status: ExecutionStatus;
  executionId: number | null;
}

const passing = (s: ExecutionStatus) => s === "passed";
const failing = (s: ExecutionStatus) => s === "failed" || s === "error";

/** How one test's status moved between a baseline run and the current run. */
export function classifyChange(previous: ExecutionStatus | null, current: ExecutionStatus): RegressionChange {
  if (previous === null) return "new_test";
  if (previous === current) return "unchanged";
  if (passing(previous) && failing(current)) return "new_failure";
  if (!passing(previous) && passing(current)) return "fixed";
  return "changed";
}

/** Compares two runs item by item (matched on itemKey). Items only in the baseline are reported as removed. */
export function diffRuns(baseline: RunItem[], current: RunItem[]): { results: RegressionResultRow[]; removed: RemovedItem[] } {
  const before = new Map(baseline.map((b) => [b.itemKey, b]));
  const results = current.map((c) => {
    const prev = before.get(c.itemKey) ?? null;
    return {
      itemKey: c.itemKey,
      title: c.title,
      status: c.status,
      previousStatus: prev?.status ?? null,
      change: classifyChange(prev?.status ?? null, c.status),
      executionId: c.executionId,
      previousExecutionId: prev?.executionId ?? null,
    };
  });
  const seen = new Set(current.map((c) => c.itemKey));
  const removed = baseline
    .filter((b) => !seen.has(b.itemKey))
    .map((b) => ({ itemKey: b.itemKey, title: b.title, previousStatus: b.status, previousExecutionId: b.executionId }));
  return { results, removed };
}

/** Pass rate in percent with one decimal; 0 for an empty run. */
export function passRate(passed: number, total: number): number {
  return total ? Math.round((passed / total) * 1000) / 10 : 0;
}
