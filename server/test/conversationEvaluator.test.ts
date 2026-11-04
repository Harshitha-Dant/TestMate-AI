import type { TurnExpectation } from "@testmate/shared";
import { describe, expect, it } from "vitest";
import { ConversationEvaluator, type PlayedTurn } from "../src/evaluators/conversationEvaluator";

const exp = (e: Partial<TurnExpectation> = {}): TurnExpectation => ({
  kind: "statement",
  mustInclude: [],
  mustIncludeAny: [],
  mustNotInclude: [],
  ...e,
});

let pos = 0;
const turn = (userMessage: string, reply: string, e: Partial<TurnExpectation> = {}, visibleTurns: number[] | null = null): PlayedTurn => ({
  position: ++pos,
  userMessage,
  reply,
  expectation: exp(e),
  visibleTurns,
  faultInjected: null,
});

const evaluator = new ConversationEvaluator();
const run = (turns: PlayedTurn[], window: number | null = 4) => {
  const result = evaluator.evaluate(turns, window);
  pos = 0;
  return result;
};

describe("ConversationEvaluator", () => {
  it("passes a conversation that recalls facts correctly", () => {
    const r = run([
      turn("My name is Ravi.", "Nice to meet you, Ravi!"),
      turn("I live in Hyderabad.", "Got it, you live in Hyderabad."),
      turn("What is my name?", "Your name is Ravi.", { kind: "recall", mustInclude: ["Ravi"] }),
    ]);
    expect(r.status).toBe("passed");
    expect(r.score).toBe(100);
    expect(r.details.firstFailureTurn).toBeNull();
    expect(r.details.facts).toEqual({ name: { value: "Ravi", turn: 1 }, city: { value: "Hyderabad", turn: 2 } });
  });

  it("pinpoints context loss and explains the memory window", () => {
    const r = run([
      turn("My name is Ravi.", "Nice to meet you, Ravi!"),
      turn("Where is my order?", "Track it in My Orders.", {}, [1]),
      turn("What is my name?", "I'm sorry, I don't remember your name.", { kind: "recall", mustInclude: ["Ravi"] }, [2]),
    ]);
    expect(r.status).toBe("failed");
    expect(r.details.firstFailureTurn).toBe(3);
    const t3 = r.details.transcript[2]!;
    expect(t3.issues[0]!.type).toBe("context_loss");
    expect(t3.issues[0]!.detail).toContain("no longer remembers");
    expect(t3.issues[0]!.detail).toContain("could only see turn 2.");
    expect(r.explanation).toMatch(/^First problem at turn 3 \(context loss\): The bot no longer remembers "Ravi"/);
  });

  it("flags contradictions with what the user said", () => {
    const r = run([
      turn("My name is Ravi.", "Nice to meet you, Ravi!"),
      turn("What is my name?", "Your name is Kiran.", { kind: "recall", mustInclude: ["Ravi"] }),
    ]);
    const issues = r.details.transcript[1]!.issues.map((i) => i.type);
    expect(issues).toEqual(["wrong_memory", "contradiction"]);
    expect(r.details.transcript[1]!.issues[0]!.detail).toBe('Expected "Ravi", but the bot answered with "Kiran".');
    expect(r.details.transcript[1]!.issues.find((i) => i.type === "contradiction")!.detail).toBe(
      'Says the name is "Kiran", but the user said "Ravi" at turn 1.',
    );
  });

  it("detects use of an outdated fact as wrong memory", () => {
    const r = run([
      turn("I live in Hyderabad.", "Got it, you live in Hyderabad."),
      turn("Actually, I moved to Bengaluru.", "Got it, you live in Bengaluru."),
      turn("Where do I live?", "You live in Hyderabad.", { kind: "recall", mustInclude: ["Bengaluru"], mustNotInclude: ["Hyderabad"] }),
    ]);
    const t3 = r.details.transcript[2]!;
    expect(t3.status).toBe("failed");
    expect(t3.issues.map((i) => i.type)).toEqual(["wrong_memory", "wrong_memory", "wrong_memory"]);
    expect(t3.issues[2]!.detail).toContain("outdated city");
  });

  it("flags the bot contradicting itself when the user never said", () => {
    const r = run([
      turn("Hello", "Your plan is Gold."),
      turn("Remind me?", "Your plan is Silver."),
    ]);
    expect(r.details.transcript[1]!.issues[0]).toEqual({
      type: "contradiction",
      detail: 'Contradicts itself: said the plan is "Gold" at turn 1, now "Silver".',
    });
  });

  it("checks follow-up validity", () => {
    const ok = run([
      turn("I want to return my shoes.", "Refunds go back within 5-7 business days."),
      turn("How many days?", "Refunds take 5-7 business days.", { kind: "follow_up", mustIncludeAny: ["5-7", "business days"] }),
    ]);
    expect(ok.status).toBe("passed");

    const bad = run([
      turn("I want to return my shoes.", "Refunds go back within 5-7 business days."),
      turn("How many days?", "I don't have information about that.", { kind: "follow_up", mustIncludeAny: ["5-7"] }),
    ]);
    expect(bad.details.transcript[1]!.issues[0]!.type).toBe("follow_up_invalid");
    expect(bad.details.transcript[1]!.issues[0]!.detail).toContain("lost the previous turn's topic");
  });

  it("grades partial recall as needs review and scores by passed turns", () => {
    const r = run([
      turn("My name is Ravi and I live in Pune.", "Nice to meet you, Ravi!"),
      turn("What do you know about me?", "You are Ravi.", { kind: "recall", mustInclude: ["Ravi", "Pune"] }),
    ]);
    expect(r.status).toBe("needs_review");
    expect(r.score).toBe(50);
    expect(r.details.firstFailureTurn).toBe(2);
  });

  it("fails empty replies", () => {
    const r = run([turn("Hi", "")]);
    expect(r.details.transcript[0]!.issues[0]!.type).toBe("empty_reply");
  });
});
