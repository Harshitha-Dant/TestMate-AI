import type {
  Bug,
  BugDetail,
  BugInput,
  BugSeverity,
  BugStatus,
  BugSummary,
  BugUpdate,
  RegressionDiff,
  RegressionRunInput,
  RegressionRunResponse,
  RegressionRunSummary,
  TestModule,
} from "@testmate/shared";
import { apiRequest } from "./client";

const p = (projectId: number) => `/projects/${projectId}`;

export const regressionApi = {
  run: (projectId: number, input: RegressionRunInput) =>
    apiRequest<RegressionRunResponse>(`${p(projectId)}/regression/runs`, { method: "POST", body: input }),
  list: (projectId: number, suiteId?: number) =>
    apiRequest<RegressionRunSummary[]>(`${p(projectId)}/regression/runs${suiteId ? `?suiteId=${suiteId}` : ""}`),
  detail: (projectId: number, id: number) => apiRequest<RegressionDiff>(`${p(projectId)}/regression/runs/${id}`),
  compare: (projectId: number, from: number, to: number) =>
    apiRequest<RegressionDiff>(`${p(projectId)}/regression/compare?from=${from}&to=${to}`),
  remove: (projectId: number, id: number) => apiRequest<{ id: number }>(`${p(projectId)}/regression/runs/${id}`, { method: "DELETE" }),
};

export interface BugFilter {
  status?: BugStatus;
  severity?: BugSeverity;
  module?: TestModule;
  q?: string;
}

export const bugsApi = {
  list: (projectId: number, f: BugFilter = {}) => {
    const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]);
    return apiRequest<Bug[]>(`${p(projectId)}/bugs${qs.size ? `?${qs}` : ""}`);
  },
  summary: (projectId: number) => apiRequest<BugSummary>(`${p(projectId)}/bugs/summary`),
  suggest: (projectId: number, executionId: number) => apiRequest<BugInput>(`${p(projectId)}/bugs/suggest?executionId=${executionId}`),
  create: (projectId: number, input: BugInput) => apiRequest<Bug>(`${p(projectId)}/bugs`, { method: "POST", body: input }),
  get: (projectId: number, id: number) => apiRequest<BugDetail>(`${p(projectId)}/bugs/${id}`),
  update: (projectId: number, id: number, u: BugUpdate) => apiRequest<BugDetail>(`${p(projectId)}/bugs/${id}`, { method: "PATCH", body: u }),
  remove: (projectId: number, id: number) => apiRequest<{ id: number }>(`${p(projectId)}/bugs/${id}`, { method: "DELETE" }),
};
