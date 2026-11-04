import { DEFAULT_CHATBOT_TARGET, type ChatbotTarget, type MockProviderConfig } from "@testmate/shared";
import type { Db } from "../db/connection";
import { projectSettingsRepo } from "../db/repositories/projectSettingsRepo";
import { badRequest } from "../lib/errors";
import { isSecretName, maskHeaders } from "../lib/secrets";
import { HttpChatbotProvider } from "../providers/httpChatbotProvider";
import { DEFAULT_MOCK_CONFIG, MockChatbotProvider } from "../providers/mockChatbotProvider";
import type { ChatbotProvider } from "../providers/types";
import { settingsService } from "./settingsService";

const MOCK_CONFIG_KEY = "mock_provider";
const TARGET_KEY = "chatbot_target";
const ONLY_PLACEHOLDER = /^\s*((Bearer|Basic|Token)\s+)?\{\{\s*secret:[A-Za-z0-9_]+\s*\}\}\s*$/i;

export const providerService = {
  getMockConfig(db: Db, projectId: number): MockProviderConfig {
    const stored = projectSettingsRepo.get<Partial<MockProviderConfig>>(db, projectId, MOCK_CONFIG_KEY);
    return { ...DEFAULT_MOCK_CONFIG, ...stored };
  },

  setMockConfig(db: Db, projectId: number, config: MockProviderConfig): MockProviderConfig {
    projectSettingsRepo.set(db, projectId, MOCK_CONFIG_KEY, config);
    return config;
  },

  getTarget(db: Db, projectId: number): ChatbotTarget {
    return projectSettingsRepo.get<ChatbotTarget>(db, projectId, TARGET_KEY) ?? DEFAULT_CHATBOT_TARGET;
  },

  /** Secret-like headers must use {{secret:NAME}}, so no credential is ever stored in the database. */
  setTarget(db: Db, projectId: number, target: ChatbotTarget): ChatbotTarget {
    if (target.kind === "http") {
      if (!target.http) throw badRequest("Enter the chatbot endpoint settings");
      const literal = target.http.headers.find((h) => h.key && isSecretName(h.key) && h.value && !ONLY_PLACEHOLDER.test(h.value));
      if (literal) {
        throw badRequest(`Use a {{secret:NAME}} placeholder for "${literal.key}"; secret values are read from the server's .env, never stored.`);
      }
      target = { ...target, http: { ...target.http, headers: maskHeaders(target.http.headers) } };
    }
    projectSettingsRepo.set(db, projectId, TARGET_KEY, target);
    return target;
  },

  /** The chatbot under test: the simulated bot, or a live HTTP endpoint using the API Studio safety settings. */
  forProject(db: Db, projectId: number): { provider: ChatbotProvider; config: MockProviderConfig; mode: string } {
    const config = providerService.getMockConfig(db, projectId);
    const target = providerService.getTarget(db, projectId);
    if (target.kind === "http" && target.http) {
      const s = settingsService.getApiStudio(db);
      const provider = new HttpChatbotProvider(target.http, {
        allowLocalhost: s.allowLocalhost,
        timeoutMs: s.timeoutMs,
        maxBytes: s.maxResponseKb * 1024,
      });
      return { provider, config, mode: "http" };
    }
    return { provider: new MockChatbotProvider(config), config, mode: config.mode };
  },
};
