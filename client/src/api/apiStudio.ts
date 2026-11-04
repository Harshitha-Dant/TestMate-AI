import type { ApiHistoryEntry, ApiRequestInput, ApiStudioSettings, Execution } from "@testmate/shared";
import { apiRequest } from "./client";

const base = (projectId: number) => `/projects/${projectId}/api-studio`;

export interface SendResult {
  entry: ApiHistoryEntry;
  execution: Execution;
}

export const apiStudioApi = {
  send: (projectId: number, input: ApiRequestInput) => apiRequest<SendResult>(`${base(projectId)}/send`, { method: "POST", body: input }),
  history: (projectId: number, limit = 50) => apiRequest<ApiHistoryEntry[]>(`${base(projectId)}/history?limit=${limit}`),
  removeHistory: (projectId: number, id: number) => apiRequest<{ id: number }>(`${base(projectId)}/history/${id}`, { method: "DELETE" }),
  clearHistory: (projectId: number) => apiRequest<{ removed: number }>(`${base(projectId)}/history`, { method: "DELETE" }),
  saved: (projectId: number) => apiRequest<ApiHistoryEntry[]>(`${base(projectId)}/saved`),
  createSaved: (projectId: number, input: ApiRequestInput) =>
    apiRequest<ApiHistoryEntry>(`${base(projectId)}/saved`, { method: "POST", body: input }),
  updateSaved: (projectId: number, id: number, input: ApiRequestInput) =>
    apiRequest<ApiHistoryEntry>(`${base(projectId)}/saved/${id}`, { method: "PUT", body: input }),
  removeSaved: (projectId: number, id: number) => apiRequest<{ id: number }>(`${base(projectId)}/saved/${id}`, { method: "DELETE" }),
  runSaved: (projectId: number, id: number) => apiRequest<SendResult>(`${base(projectId)}/saved/${id}/run`, { method: "POST" }),
};

export const settingsApi = {
  getApiStudio: () => apiRequest<ApiStudioSettings>("/settings/api-studio"),
  setApiStudio: (s: ApiStudioSettings) => apiRequest<ApiStudioSettings>("/settings/api-studio", { method: "PUT", body: s }),
};
