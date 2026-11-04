import type { MockFault, MockProviderConfig } from "@testmate/shared";
import { extractUserFacts, recallSlot } from "../lib/conversationFacts";
import { containsPhrase, hashUnit } from "../lib/text";
import { detectLanguage } from "../lib/languageDetect";
import { answerIn, MOCK_KNOWLEDGE_BASE, type KbEntry, type ReplyLanguage } from "./mockKnowledgeBase";
import type { ChatbotProvider, ChatMessage, ProviderReply, SimulationHints } from "./types";

export const DEFAULT_MOCK_CONFIG: MockProviderConfig = {
  mode: "knowledge-base",
  failureRate: 0.2,
  faults: ["omit_detail", "off_topic", "forbidden_claim", "empty", "wrong_memory", "wrong_language"],
  seed: 42,
  memoryWindow: 4,
};

const GENERIC_FALSE_CLAIM = "All orders also come with a free lifetime replacement guarantee.";

/** Plausible but wrong values used by the wrong_memory fault. */
const DECOYS: Record<string, string[]> = {
  name: ["Kiran", "Priya", "Arjun"],
  city: ["Chennai", "Pune", "Kolkata"],
  "order number": ["ORD-10001", "ORD-55555"],
};

const BUILT_IN_SLOTS = new Set(["name", "city", "order number"]);

type ReplyKind = "acknowledge" | "recall" | "answer";

interface Composed {
  text: string;
  kind: ReplyKind;
  slot?: string;
  intent?: KbEntry | null;
  language?: ReplyLanguage;
}

/** The bot answers in the question's language (the main one for mixed text); English when unsure. */
export function replyLanguageFor(question: string): ReplyLanguage {
  const { language, primary } = detectLanguage(question);
  const chosen = language === "mixed" ? primary : language;
  return chosen === "te" || chosen === "te-Latn" || chosen === "hi" || chosen === "hi-Latn" ? chosen : "en";
}

/**
 * Deterministic simulated chatbot. The same conversation, config and seed always give the same reply,
 * so runs are reproducible; change the seed or failure rate to simulate a different bot version.
 *
 * Memory: the bot only sees the last `memoryWindow` user turns before the current one. It remembers
 * facts users state ("My name is Ravi") and resolves follow-ups from the previous visible turn.
 * Faults are injected deliberately (and reported) so failing tests can be demonstrated.
 */
export class MockChatbotProvider implements ChatbotProvider {
  readonly name = "mock";
  readonly source = "mock" as const;

  constructor(private readonly config: MockProviderConfig = DEFAULT_MOCK_CONFIG) {}

  async reply(messages: ChatMessage[], hints: SimulationHints = {}): Promise<ProviderReply> {
    const userTurns = messages.filter((m) => m.role === "user").map((m) => m.content);
    const question = userTurns[userTurns.length - 1] ?? "";
    const visible = this.visibleHistory(userTurns.slice(0, -1));
    const facts = rememberFacts(visible);

    const composed = this.compose(question, visible, facts, hints);
    const fault = this.pickFault(question, userTurns.length - 1, composed.kind, hints);
    if (!fault) return { text: composed.text, faultInjected: null };
    return { text: applyFault(fault, composed, question, hints, facts), faultInjected: fault };
  }

  /** The earlier user turns the bot can still "see". */
  visibleHistory(previous: string[]): string[] {
    const { memoryWindow } = this.config;
    return memoryWindow > 0 ? previous.slice(-memoryWindow) : [];
  }

  private compose(
    question: string,
    visible: string[],
    facts: Map<string, string>,
    hints: SimulationHints,
  ): Composed {
    const stated = extractUserFacts(question);
    if (stated.length) return { text: stated.map((f) => acknowledge(f.slot, f.value)).join(" "), kind: "acknowledge" };

    // Built-in slots are always treated as recall; generic ones ("what is my order status?") only when
    // that fact was actually stated, so ordinary questions still reach the knowledge base.
    const slot = recallSlot(question);
    if (slot && (BUILT_IN_SLOTS.has(slot) || facts.has(slot))) {
      const value = facts.get(slot);
      return value
        ? { text: recallSentence(slot, value), kind: "recall", slot }
        : { text: `I'm sorry, I don't remember your ${slot}. Could you tell me again?`, kind: "answer" };
    }

    if (this.config.mode === "echo-expected" && hints.expected?.trim()) return { text: hints.expected.trim(), kind: "answer" };

    // Follow-up: no intent in this question, so reuse the topic of the most recent visible turn.
    const intent = matchIntent(question) ?? [...visible].reverse().map(matchIntent).find(Boolean) ?? null;
    const language = replyLanguageFor(question);
    return { text: answerIn(intent, language), kind: "answer", intent, language };
  }

  private pickFault(question: string, turnIndex: number, kind: ReplyKind, hints: SimulationHints): MockFault | null {
    const { failureRate, seed } = this.config;
    // wrong_memory only makes sense when the bot actually remembers the fact it is asked about, and
    // wrong_language only in multilingual tests. Filtering keeps other labs' fault picks unchanged.
    const faults = this.config.faults.filter(
      (f) => (f !== "wrong_memory" || kind === "recall") && (f !== "wrong_language" || hints.multilingual),
    );
    if (faults.length === 0 || failureRate <= 0) return null;
    const key = turnIndex > 0 ? `${question}#${turnIndex}` : question;
    if (hashUnit(`${seed}|fail|${key}`) >= failureRate) return null;
    return faults[Math.floor(hashUnit(`${seed}|fault|${key}`) * faults.length)] ?? null;
  }
}

/** Latest value per slot from the visible user turns (later statements overwrite earlier ones). */
function rememberFacts(visible: string[]): Map<string, string> {
  const facts = new Map<string, string>();
  for (const turn of visible) for (const f of extractUserFacts(turn)) facts.set(f.slot, f.value);
  return facts;
}

function acknowledge(slot: string, value: string): string {
  if (slot === "name") return `Nice to meet you, ${value}!`;
  if (slot === "city") return `Got it, you live in ${value}.`;
  if (slot === "order number") return `Thanks, I've noted order ${value}.`;
  return `Noted: your ${slot} is ${value}.`;
}

function recallSentence(slot: string, value: string): string {
  if (slot === "city") return `You live in ${value}.`;
  return `Your ${slot} is ${value}.`;
}

export function matchIntent(question: string): KbEntry | null {
  let best: { entry: KbEntry; score: number } | null = null;
  for (const entry of MOCK_KNOWLEDGE_BASE) {
    const score = [...entry.keywords, ...entry.localKeywords].filter((k) => containsPhrase(question, k)).length;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}

function applyFault(
  fault: MockFault,
  composed: Composed,
  question: string,
  hints: SimulationHints,
  facts: Map<string, string>,
): string {
  const { text: answer, slot } = composed;
  const language = composed.language ?? "en";
  switch (fault) {
    case "empty":
      return "";
    case "omit_detail": {
      // Drop the last sentence; for single sentences keep only the first half of the words.
      const sentences = answer.match(/[^.!?]+[.!?]*/g)?.map((s) => s.trim()).filter(Boolean) ?? [answer];
      if (sentences.length > 1) return sentences.slice(0, -1).join(" ");
      const words = answer.split(/\s+/);
      return words.slice(0, Math.max(1, Math.ceil(words.length / 2))).join(" ");
    }
    case "off_topic": {
      const own = matchIntent(question);
      const others = MOCK_KNOWLEDGE_BASE.filter((e) => e !== own && e.intent !== "greeting");
      return answerIn(others[Math.floor(hashUnit(`off|${question}`) * others.length)] ?? null, language);
    }
    case "forbidden_claim": {
      const term = hints.forbiddenKeywords?.[0];
      return `${answer} ${term ? `Note: ${term}.` : GENERIC_FALSE_CLAIM}`;
    }
    case "wrong_language":
      // Same content, wrong language: English instead of the user's language (Hindi if they wrote English).
      return answerIn(composed.intent ?? null, language === "en" ? "hi" : "en");
    case "wrong_memory": {
      if (!slot) return answer;
      const actual = facts.get(slot);
      const pool = (DECOYS[slot] ?? ["something else"]).filter((d) => d !== actual);
      const decoy = pool[Math.floor(hashUnit(`decoy|${question}`) * pool.length)] ?? "something else";
      return recallSentence(slot, decoy);
    }
  }
}
