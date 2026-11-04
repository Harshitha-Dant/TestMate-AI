import type { TestCriteria } from "@testmate/shared";
import { describe, expect, it } from "vitest";
import { RuleBasedEvaluator } from "../src/evaluators/ruleBasedEvaluator";
import { containsPhrase, normalize, tokenOverlap } from "../src/lib/text";

const base: TestCriteria = {
  matchMode: "keywords",
  requiredKeywords: [],
  forbiddenKeywords: [],
  minRelevance: 60,
  minLength: null,
  maxLength: null,
};
const evaluator = new RuleBasedEvaluator();
const evaluate = (output: string, expected: string, criteria: Partial<TestCriteria> = {}) =>
  evaluator.evaluate({ output, expected, criteria: { ...base, ...criteria } });
const check = (r: ReturnType<typeof evaluate>, id: string) => r.checks.find((c) => c.id === id)!;

describe("text helpers", () => {
  it("normalizes case, punctuation and whitespace but keeps Indic combining marks", () => {
    expect(normalize("  Hello,   WORLD!! ")).toBe("hello world");
    expect(normalize("నా ఆర్డర్ ఎక్కడ ఉంది?")).toBe("నా ఆర్డర్ ఎక్కడ ఉంది");
    expect(normalize("मेरा ऑर्डर कहाँ है?")).toBe("मेरा ऑर्डर कहाँ है");
  });

  it("matches phrases on word boundaries, allowing suffixes only on longer words", () => {
    expect(containsPhrase("Refunds are processed", "refund")).toBe(true);
    expect(containsPhrase("Your 5-7 business days", "5-7 business days")).toBe(true);
    expect(containsPhrase("Check your history", "hi")).toBe(false);
    expect(containsPhrase("Hi there", "hi")).toBe(true);
    expect(containsPhrase("prefund", "refund")).toBe(false);
    expect(containsPhrase("నా ఆర్డర్ ఎక్కడ ఉంది", "ఆర్డర్")).toBe(true);
  });

  it("computes token overlap against the expected answer's content words", () => {
    expect(tokenOverlap("Refunds take 5-7 business days", "Refund in 5-7 business days").score).toBe(100);
    const partial = tokenOverlap("Refunds take 5-7 business days", "Refund within 5-7 business days");
    expect(partial).toEqual({ score: 83, missing: ["within"] });
    expect(tokenOverlap("Hello there", "Refund within 7 days").missing).toEqual(["refund", "within", "7", "days"]);
    // Short tokens must match whole: "2" is not found inside "24".
    expect(tokenOverlap("Cancel within 24 hours", "Arrives in 1-2 days").missing).toEqual(["arrives", "1", "2", "days"]);
  });
});

describe("RuleBasedEvaluator", () => {
  it("passes a response that covers keywords and the expected answer", () => {
    const r = evaluate("Refunds go to your card within 5-7 business days.", "Refunds within 5-7 business days.", {
      requiredKeywords: ["refund", "5-7 business days"],
    });
    expect(r.status).toBe("passed");
    expect(r.explanation).toBe("All rule-based checks passed.");
    expect(r.score).toBe(100);
  });

  it("fails an empty response", () => {
    const r = evaluate("   ", "Anything");
    expect(r.status).toBe("failed");
    expect(check(r, "non_empty").outcome).toBe("fail");
  });

  it("names missing keywords and grades partial coverage as needs review", () => {
    const r = evaluate("Refunds are sent to your card.", "", { requiredKeywords: ["refund", "5-7 business days"] });
    expect(r.status).toBe("needs_review");
    expect(r.explanation).toContain('"5-7 business days"');
    expect(check(r, "required_keywords").score).toBe(50);
  });

  it("fails when most required keywords are missing", () => {
    const r = evaluate("I can't help.", "", { requiredKeywords: ["refund", "card", "days"] });
    expect(r.status).toBe("failed");
  });

  it("fails on forbidden terms regardless of other checks", () => {
    const r = evaluate("Refunds take 5-7 days. Lifetime guarantee included!", "Refunds take 5-7 days", {
      forbiddenKeywords: ["guarantee"],
    });
    expect(r.status).toBe("failed");
    expect(r.explanation).toContain('Contains forbidden terms: "guarantee"');
  });

  it("supports exact and contains match modes", () => {
    expect(evaluate("yes.", "Yes", { matchMode: "exact" }).status).toBe("passed");
    expect(evaluate("Yes, I can", "Yes", { matchMode: "exact" }).status).toBe("failed");
    expect(check(evaluate("Sure: open 9 to 9 daily", "open 9 to 9", { matchMode: "contains" }), "match").outcome).toBe("pass");
    expect(check(evaluate("We open at nine", "open 9 to 9", { matchMode: "contains" }), "match").outcome).toBe("review");
  });

  it("grades relevance with a review margin below the threshold", () => {
    const expected = "Standard delivery takes three to five business days";
    expect(evaluate("Standard delivery takes five business days", expected).status).toBe("passed");
    // 4 of 7 content words (57%): below 70 but within the 20-point review margin.
    const partial = check(evaluate("Delivery takes some business days", expected, { minRelevance: 70 }), "relevance");
    expect(partial).toMatchObject({ outcome: "review", score: 57 });
    expect(check(evaluate("Delivery takes some business days", expected, { minRelevance: 90 }), "relevance").outcome).toBe("fail");
    expect(evaluate("Hello! How can I help?", expected).status).toBe("failed");
  });

  it("enforces length limits", () => {
    expect(evaluate("Short", "", { minLength: 10 }).status).toBe("failed");
    expect(evaluate("This one is far too long", "", { maxLength: 5 }).explanation).toContain("too long");
    expect(evaluate("Just right", "", { minLength: 3, maxLength: 50 }).status).toBe("passed");
  });
});
