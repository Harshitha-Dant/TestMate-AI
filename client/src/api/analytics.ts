import type { Analytics, Preferences } from "@testmate/shared";
import { apiRequest } from "./client";

/** null = all time. */
export type RangeDays = number | null;

const daysParam = (days: RangeDays) => `days=${days ?? "all"}`;

export const analyticsApi = {
  get: (projectId: number, days: RangeDays) => apiRequest<Analytics>(`/projects/${projectId}/analytics?${daysParam(days)}`),
  /** Download URLs (same-origin GETs, served as attachments). */
  executionsCsvUrl: (projectId: number, days: RangeDays) => `/api/projects/${projectId}/reports/executions.csv?${daysParam(days)}`,
  regressionCsvUrl: (projectId: number) => `/api/projects/${projectId}/reports/regression.csv`,
  pdfUrl: (projectId: number, days: RangeDays) => `/api/projects/${projectId}/reports/report.pdf?${daysParam(days)}`,
};

export const preferencesApi = {
  get: () => apiRequest<Preferences>("/settings/preferences"),
  set: (p: Preferences) => apiRequest<Preferences>("/settings/preferences", { method: "PUT", body: p }),
};

export const demoApi = {
  seed: () => apiRequest<{ projectId: number; created: boolean }>("/demo", { method: "POST" }),
  clear: () => apiRequest<{ removed: Record<string, number> }>("/demo", { method: "DELETE" }),
};
