import { describe, expect, it } from "vitest";
import { DEFAULT_MOCK_CONFIG, matchIntent, MockChatbotProvider } from "../src/providers/mockChatbotProvider";
import { MOCK_FALLBACK_ANSWER } from "../src/providers/mockKnowledgeBase";

const ask = (p: MockChatbotProvider, q: string, hints = {}) => p.reply([{ role: "user", content: q }], hints);
const reliable = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 0 });

describe("MockChatbotProvider", () => {
  it("answers from the knowledge base by intent, preferring specific intents", async () => {
    expect(matchIntent("Where is my order?")?.intent).toBe("order_status");
    expect(matchIntent("How do I cancel my order?")?.intent).toBe("cancel_order");
    expect(matchIntent("When will my order arrive?")?.intent).toBe("delivery_time");
    expect(matchIntent("Show my history")).toBeNull();
    expect((await ask(reliable, "What is the weather?")).text).toBe(MOCK_FALLBACK_ANSWER);
  });

  it("is deterministic for the same input and seed", async () => {
    const p = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 0.5 });
    const questions = ["Where is my order?", "refund please", "reset password", "support hours", "pay by UPI?"];
    const first = await Promise.all(questions.map((q) => ask(p, q)));
    const second = await Promise.all(questions.map((q) => ask(p, q)));
    expect(second).toEqual(first);
  });

  it("never injects faults at failureRate 0 and always does at 1", async () => {
    expect((await ask(reliable, "refund please")).faultInjected).toBeNull();
    const broken = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 1, faults: ["empty"] });
    expect(await ask(broken, "refund please")).toEqual({ text: "", faultInjected: "empty" });
  });

  it("injects each fault type in a recognizable way", async () => {
    const make = (fault: (typeof DEFAULT_MOCK_CONFIG.faults)[number]) =>
      new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 1, faults: [fault] });
    const good = (await ask(reliable, "How long does delivery take?")).text;

    const omitted = (await ask(make("omit_detail"), "How long does delivery take?")).text;
    expect(good.startsWith(omitted)).toBe(true);
    expect(omitted.length).toBeLessThan(good.length);

    const claim = await ask(make("forbidden_claim"), "refund?", { forbiddenKeywords: ["lifetime guarantee"] });
    expect(claim.text).toContain("lifetime guarantee");

    const offTopic = (await ask(make("off_topic"), "refund?")).text;
    expect(offTopic).not.toContain("Refunds");
  });

  it("echoes the expected answer in echo-expected mode", async () => {
    const echo = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, mode: "echo-expected", failureRate: 0 });
    expect((await ask(echo, "anything", { expected: "Exactly this." })).text).toBe("Exactly this.");
  });
});
