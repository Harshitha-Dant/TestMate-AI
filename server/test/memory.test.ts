import { describe, expect, it } from "vitest";
import { cleanValue, extractBotFacts, extractUserFacts, recallSlot, signalsForgetting } from "../src/lib/conversationFacts";
import { DEFAULT_MOCK_CONFIG, MockChatbotProvider } from "../src/providers/mockChatbotProvider";
import type { ChatMessage } from "../src/providers/types";

describe("conversation fact extraction", () => {
  it("extracts facts users state", () => {
    expect(extractUserFacts("Hi, my name is Ravi.")).toEqual([{ slot: "name", value: "Ravi" }]);
    expect(extractUserFacts("I live in Hyderabad")).toEqual([{ slot: "city", value: "Hyderabad" }]);
    expect(extractUserFacts("Actually, I moved to Bengaluru last month.")).toEqual([{ slot: "city", value: "Bengaluru" }]);
    expect(extractUserFacts("My order number is ORD-48213.")).toEqual([{ slot: "order number", value: "ORD-48213" }]);
    expect(extractUserFacts("My favourite colour is blue")).toEqual([{ slot: "favourite colour", value: "blue" }]);
    expect(extractUserFacts("I'm Ravi Kumar and I need help")).toEqual([{ slot: "name", value: "Ravi Kumar" }]);
    expect(extractUserFacts("I'm hungry")).toEqual([]);
    expect(extractUserFacts("Where is my order?")).toEqual([]);
  });

  it("extracts facts the bot asserts, without misreading greetings", () => {
    expect(extractBotFacts("Your name is Kiran.")).toEqual([{ slot: "name", value: "Kiran" }]);
    expect(extractBotFacts("Nice to meet you, Ravi!")).toEqual([{ slot: "name", value: "Ravi" }]);
    expect(extractBotFacts("You live in Pune.")).toEqual([{ slot: "city", value: "Pune" }]);
    expect(extractBotFacts("Hi there, how can I help?")).toEqual([]);
    expect(extractBotFacts("Hello! I'm the support assistant.")).toEqual([]);
  });

  it("detects recall questions and forgetting", () => {
    expect(recallSlot("What is my name?")).toBe("name");
    expect(recallSlot("Where do I live?")).toBe("city");
    expect(recallSlot("what's my order number")).toBe("order number");
    expect(recallSlot("What is my favourite colour?")).toBe("favourite colour");
    expect(recallSlot("How long does delivery take?")).toBeNull();
    expect(signalsForgetting("I'm sorry, I don't remember your name.")).toBe(true);
    expect(signalsForgetting("Your name is Ravi.")).toBe(false);
    expect(cleanValue("Bengaluru last month.")).toBe("Bengaluru");
  });
});

/** Plays a script against the provider and returns each reply. */
async function play(provider: MockChatbotProvider, userTurns: string[]) {
  const messages: ChatMessage[] = [];
  const replies: { text: string; faultInjected?: string | null }[] = [];
  for (const content of userTurns) {
    messages.push({ role: "user", content });
    const reply = await provider.reply(messages);
    messages.push({ role: "assistant", content: reply.text });
    replies.push(reply);
  }
  return replies;
}

const reliable = (memoryWindow: number) => new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 0, memoryWindow });

describe("MockChatbotProvider memory", () => {
  it("acknowledges and recalls facts inside its memory window", async () => {
    const r = await play(reliable(4), ["My name is Ravi.", "I live in Hyderabad.", "What is my name?", "Where do I live?"]);
    expect(r.map((x) => x.text)).toEqual([
      "Nice to meet you, Ravi!",
      "Got it, you live in Hyderabad.",
      "Your name is Ravi.",
      "You live in Hyderabad.",
    ]);
  });

  it("forgets facts that fall outside the memory window", async () => {
    const script = ["My name is Ravi.", "Where is my order?", "Can I pay by UPI?", "How long is delivery?", "What is my name?"];
    expect((await play(reliable(4), script))[4]!.text).toBe("Your name is Ravi.");
    expect((await play(reliable(3), script))[4]!.text).toMatch(/don't remember your name/);
    expect((await play(reliable(0), ["My name is Ravi.", "What is my name?"]))[1]!.text).toMatch(/don't remember/);
  });

  it("uses the latest value when the user corrects a fact", async () => {
    const r = await play(reliable(4), ["I live in Hyderabad.", "Actually, I moved to Bengaluru last month.", "Where do I live?"]);
    expect(r[2]!.text).toBe("You live in Bengaluru.");
  });

  it("resolves follow-ups from the previous turn only when it is remembered", async () => {
    const script = ["I want to return my shoes.", "How many days will that take?"];
    expect((await play(reliable(4), script))[1]!.text).toContain("5-7 business days");
    expect((await play(reliable(0), script))[1]!.text).toMatch(/don't have information/);
  });

  it("keeps ordinary questions on the knowledge base", async () => {
    const [r] = await play(reliable(4), ["What is my order status?"]);
    expect(r!.text).toContain("track your order");
  });

  it("injects wrong_memory only on recall turns", async () => {
    const p = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 1, faults: ["wrong_memory"], memoryWindow: 4 });
    const r = await play(p, ["My name is Ravi.", "What is my name?"]);
    expect(r[0]).toEqual({ text: "Nice to meet you, Ravi!", faultInjected: null });
    expect(r[1]!.faultInjected).toBe("wrong_memory");
    expect(r[1]!.text).toMatch(/^Your name is (Kiran|Priya|Arjun)\.$/);
  });

  it("does not inject wrong_memory when the fact is already forgotten", async () => {
    const p = new MockChatbotProvider({ ...DEFAULT_MOCK_CONFIG, failureRate: 1, faults: ["wrong_memory"], memoryWindow: 0 });
    const r = await play(p, ["My name is Ravi.", "What is my name?"]);
    expect(r[1]).toEqual({ text: "I'm sorry, I don't remember your name. Could you tell me again?", faultInjected: null });
  });
});
