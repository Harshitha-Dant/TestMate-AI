import type { ResultSource } from "@testmate/shared";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Hints only a simulator may use to shape deliberate faults. A real chatbot never sees them,
 * and live providers must ignore them.
 */
export interface SimulationHints {
  expected?: string;
  forbiddenKeywords?: string[];
  /** Set by the Multilingual Lab so the simulator may inject wrong-language replies. */
  multilingual?: boolean;
}

export interface ProviderReply {
  text: string;
  /** Simulators report which deliberate fault they injected; live providers leave this undefined. */
  faultInjected?: string | null;
}

export interface ChatbotProvider {
  readonly name: string;
  /** "mock" results must always be labeled as simulated. */
  readonly source: ResultSource;
  /** Reply to the last user message, given the whole conversation so far. */
  reply(messages: ChatMessage[], hints?: SimulationHints): Promise<ProviderReply>;
}
