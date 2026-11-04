import type { RegressionChange, TestModule } from "@testmate/shared";

export const MODULE_LABELS: Record<TestModule, string> = {
  chatbot: "Chatbot Lab",
  memory: "Memory Lab",
  multilingual: "Multilingual Lab",
  api: "API Studio",
};

export const CHANGE_META: Record<RegressionChange | "removed", { label: string; hint: string; tone: string }> = {
  new_failure: { label: "New failures", hint: "Passed in the baseline, fail now", tone: "text-failure" },
  fixed: { label: "Fixed", hint: "Weren't passing, pass now", tone: "text-success" },
  changed: { label: "Changed", hint: "Other status changes, e.g. passed → needs review", tone: "text-warning" },
  new_test: { label: "New tests", hint: "Not in the baseline run", tone: "text-accent" },
  removed: { label: "Removed", hint: "In the baseline, no longer in the suite", tone: "text-muted" },
  unchanged: { label: "Unchanged", hint: "Same status as the baseline", tone: "text-muted" },
};

export function formatDelta(delta: number | null): string {
  if (delta === null) return "–";
  if (delta === 0) return "±0 pts";
  return `${delta > 0 ? "+" : ""}${delta} pts`;
}

export function deltaTone(delta: number | null): string {
  if (delta === null || delta === 0) return "text-muted";
  return delta > 0 ? "text-success" : "text-failure";
}
