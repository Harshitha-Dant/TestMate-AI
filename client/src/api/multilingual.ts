import type { LanguageDetection, LanguageSummaryRow } from "@testmate/shared";
import { apiRequest } from "./client";

export const multilingualApi = {
  summary: (projectId: number) => apiRequest<LanguageSummaryRow[]>(`/projects/${projectId}/multilingual/summary`),
  addSamples: (projectId: number) =>
    apiRequest<{ suiteId: number; created: number[] }>(`/projects/${projectId}/multilingual/samples`, { method: "POST" }),
  detect: (text: string) => apiRequest<LanguageDetection>("/language/detect", { method: "POST", body: { text } }),
};
