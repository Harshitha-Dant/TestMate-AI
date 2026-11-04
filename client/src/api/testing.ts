import type {
  ChatbotTarget,
  ConversationScript,
  ConversationScriptInput,
  Execution,
  ExecutionStatus,
  MockProviderConfig,
  OverrideInput,
  ResultSource,
  SuiteInput,
  SuiteRunResult,
  TestCase,
  TestCaseInput,
  TestModule,
  TestSuite,
} from "@testmate/shared";
import { apiRequest } from "./client";

const p = (projectId: number) => `/projects/${projectId}`;

export type CaseFilter = number | "none" | undefined;

export const suitesApi = {
  list: (projectId: number, module: TestModule) => apiRequest<TestSuite[]>(`${p(projectId)}/suites?module=${module}`),
  listAll: (projectId: number) => apiRequest<TestSuite[]>(`${p(projectId)}/suites`),
  create: (projectId: number, module: TestModule, input: SuiteInput) =>
    apiRequest<TestSuite>(`${p(projectId)}/suites`, { method: "POST", body: { module, ...input } }),
  update: (projectId: number, id: number, input: Partial<SuiteInput>) =>
    apiRequest<TestSuite>(`${p(projectId)}/suites/${id}`, { method: "PATCH", body: input }),
  remove: (projectId: number, id: number) => apiRequest<{ id: number }>(`${p(projectId)}/suites/${id}`, { method: "DELETE" }),
  run: (projectId: number, id: number) => apiRequest<SuiteRunResult>(`${p(projectId)}/suites/${id}/run`, { method: "POST" }),
};

export const testCasesApi = {
  list: (projectId: number, module: TestCase["module"], suiteId?: CaseFilter) =>
    apiRequest<TestCase[]>(
      `${p(projectId)}/test-cases?module=${module}${suiteId !== undefined ? `&suiteId=${suiteId}` : ""}`,
    ),
  create: (projectId: number, module: TestCase["module"], input: TestCaseInput) =>
    apiRequest<TestCase>(`${p(projectId)}/test-cases`, { method: "POST", body: { module, ...input } }),
  update: (projectId: number, id: number, input: TestCaseInput) =>
    apiRequest<TestCase>(`${p(projectId)}/test-cases/${id}`, { method: "PUT", body: input }),
  remove: (projectId: number, id: number) =>
    apiRequest<{ id: number }>(`${p(projectId)}/test-cases/${id}`, { method: "DELETE" }),
  run: (projectId: number, id: number) =>
    apiRequest<Execution>(`${p(projectId)}/test-cases/${id}/run`, { method: "POST" }),
};

export const conversationsApi = {
  list: (projectId: number, suiteId?: CaseFilter) =>
    apiRequest<ConversationScript[]>(`${p(projectId)}/conversations${suiteId !== undefined ? `?suiteId=${suiteId}` : ""}`),
  create: (projectId: number, input: ConversationScriptInput) =>
    apiRequest<ConversationScript>(`${p(projectId)}/conversations`, { method: "POST", body: input }),
  update: (projectId: number, id: number, input: ConversationScriptInput) =>
    apiRequest<ConversationScript>(`${p(projectId)}/conversations/${id}`, { method: "PUT", body: input }),
  remove: (projectId: number, id: number) =>
    apiRequest<{ id: number }>(`${p(projectId)}/conversations/${id}`, { method: "DELETE" }),
  run: (projectId: number, id: number) =>
    apiRequest<Execution>(`${p(projectId)}/conversations/${id}/run`, { method: "POST" }),
};

export interface ExecutionQuery {
  module?: TestModule;
  testCaseId?: number;
  sessionId?: number;
  status?: ExecutionStatus;
  source?: ResultSource;
  q?: string;
  days?: number;
  limit?: number;
  offset?: number;
}

export const executionsApi = {
  list: (projectId: number, q: ExecutionQuery) => {
    const qs = new URLSearchParams(
      Object.entries(q)
        .filter(([, v]) => v !== undefined && v !== "")
        .map(([k, v]) => [k, String(v)]),
    );
    return apiRequest<{ items: Execution[]; total: number }>(`${p(projectId)}/executions?${qs}`);
  },
  get: (projectId: number, id: number) => apiRequest<Execution>(`${p(projectId)}/executions/${id}`),
  override: (projectId: number, id: number, input: OverrideInput) =>
    apiRequest<Execution>(`${p(projectId)}/executions/${id}/override`, { method: "PATCH", body: input }),
};

export const providerApi = {
  getTarget: (projectId: number) => apiRequest<ChatbotTarget>(`${p(projectId)}/provider/target`),
  setTarget: (projectId: number, target: ChatbotTarget) =>
    apiRequest<ChatbotTarget>(`${p(projectId)}/provider/target`, { method: "PUT", body: target }),
  getMock: (projectId: number) => apiRequest<MockProviderConfig>(`${p(projectId)}/provider/mock`),
  setMock: (projectId: number, config: MockProviderConfig) =>
    apiRequest<MockProviderConfig>(`${p(projectId)}/provider/mock`, { method: "PUT", body: config }),
};
