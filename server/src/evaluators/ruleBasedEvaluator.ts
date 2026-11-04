import type { CheckOutcome, EvaluationCheck } from "@testmate/shared";
import { containsPhrase, normalize, tokenOverlap } from "../lib/text";
import type { EvaluationInput, EvaluationResult, Evaluator } from "./types";

/** Within this many points below the relevance threshold, a result needs review instead of failing. */
const REVIEW_MARGIN = 20;

const OUTCOME_RANK: Record<CheckOutcome, number> = { skip: 0, pass: 1, review: 2, fail: 3 };

/**
 * Transparent rule-based evaluator: normalized text matching, keyword coverage, forbidden terms,
 * token-overlap relevance and length limits. It does not understand meaning, paraphrase or translation.
 */
export class RuleBasedEvaluator implements Evaluator {
  readonly name = "rule-based" as const;

  evaluate({ output, expected, criteria }: EvaluationInput): EvaluationResult {
    const checks: EvaluationCheck[] = [];
    const empty = normalize(output) === "";

    checks.push({
      id: "non_empty",
      label: "Response present",
      outcome: empty ? "fail" : "pass",
      detail: empty ? "The chatbot returned an empty response." : `${output.trim().length} characters returned.`,
    });

    checks.push(matchCheck(output, expected, criteria.matchMode));
    checks.push(requiredKeywordsCheck(output, criteria.requiredKeywords));
    checks.push(forbiddenCheck(output, criteria.forbiddenKeywords));
    checks.push(relevanceCheck(output, expected, criteria.minRelevance));
    checks.push(lengthCheck(output, criteria.minLength, criteria.maxLength));

    const worst = checks.reduce<CheckOutcome>(
      (acc, c) => (OUTCOME_RANK[c.outcome] > OUTCOME_RANK[acc] ? c.outcome : acc),
      "skip",
    );
    const status = worst === "fail" ? "failed" : worst === "review" ? "needs_review" : "passed";

    const graded = checks.filter((c) => c.outcome !== "skip");
    const score = Math.round(
      graded.reduce((sum, c) => sum + (c.score ?? (c.outcome === "pass" ? 100 : c.outcome === "review" ? 50 : 0)), 0) /
        Math.max(graded.length, 1),
    );

    const problems = checks.filter((c) => c.outcome === "fail" || c.outcome === "review").map((c) => c.detail);
    const explanation =
      problems.length === 0 ? "All rule-based checks passed." : problems.join(" ");

    return { status, score, checks, explanation };
  }
}

function matchCheck(output: string, expected: string, mode: EvaluationInput["criteria"]["matchMode"]): EvaluationCheck {
  if (mode === "keywords" || !expected.trim()) {
    return { id: "match", label: "Expected answer match", outcome: "skip", detail: "Not required (keyword mode)." };
  }
  if (mode === "exact") {
    const equal = normalize(output) === normalize(expected);
    return {
      id: "match",
      label: "Exact match (normalized)",
      outcome: equal ? "pass" : "fail",
      detail: equal
        ? "Response matches the expected answer after normalization."
        : "Response does not exactly match the expected answer (case, spacing and punctuation ignored).",
    };
  }
  const contained = containsPhrase(output, expected);
  return {
    id: "match",
    label: "Contains expected answer",
    outcome: contained ? "pass" : "review",
    detail: contained
      ? "The expected answer appears in the response."
      : "The expected answer text does not appear verbatim; it may be paraphrased, so check it manually.",
  };
}

function requiredKeywordsCheck(output: string, keywords: string[]): EvaluationCheck {
  if (keywords.length === 0) {
    return { id: "required_keywords", label: "Required keywords", outcome: "skip", detail: "No required keywords set." };
  }
  const missing = keywords.filter((k) => !containsPhrase(output, k));
  const coverage = Math.round(((keywords.length - missing.length) / keywords.length) * 100);
  const outcome: CheckOutcome = missing.length === 0 ? "pass" : coverage >= 50 ? "review" : "fail";
  return {
    id: "required_keywords",
    label: "Required keywords",
    outcome,
    score: coverage,
    detail:
      missing.length === 0
        ? `All ${keywords.length} required keywords found.`
        : `Missing required keywords: ${missing.map((m) => `"${m}"`).join(", ")} (${coverage}% coverage).`,
  };
}

function forbiddenCheck(output: string, forbidden: string[]): EvaluationCheck {
  if (forbidden.length === 0) {
    return { id: "forbidden", label: "Forbidden terms", outcome: "skip", detail: "No forbidden terms set." };
  }
  const found = forbidden.filter((k) => containsPhrase(output, k));
  return {
    id: "forbidden",
    label: "Forbidden terms",
    outcome: found.length ? "fail" : "pass",
    detail: found.length
      ? `Contains forbidden terms: ${found.map((f) => `"${f}"`).join(", ")}.`
      : "No forbidden terms found.",
  };
}

function relevanceCheck(output: string, expected: string, minRelevance: number): EvaluationCheck {
  if (!expected.trim()) {
    return { id: "relevance", label: "Relevance", outcome: "skip", detail: "No expected answer to compare against." };
  }
  const { score, missing } = tokenOverlap(output, expected);
  const outcome: CheckOutcome =
    score >= minRelevance ? "pass" : score >= minRelevance - REVIEW_MARGIN ? "review" : "fail";
  const missingNote = missing.length ? ` Missing words from the expected answer: ${missing.slice(0, 8).join(", ")}.` : "";
  return {
    id: "relevance",
    label: "Relevance (word overlap)",
    outcome,
    score,
    detail:
      outcome === "pass"
        ? `${score}% of the expected answer's key words appear (threshold ${minRelevance}%).`
        : `Only ${score}% of the expected answer's key words appear (threshold ${minRelevance}%).${missingNote}`,
  };
}

function lengthCheck(output: string, min: number | null, max: number | null): EvaluationCheck {
  if (min === null && max === null) {
    return { id: "length", label: "Length limits", outcome: "skip", detail: "No length limits set." };
  }
  const len = output.trim().length;
  if (min !== null && len < min) {
    return { id: "length", label: "Length limits", outcome: "fail", detail: `Response is too short (${len} < ${min} characters).` };
  }
  if (max !== null && len > max) {
    return { id: "length", label: "Length limits", outcome: "fail", detail: `Response is too long (${len} > ${max} characters).` };
  }
  return { id: "length", label: "Length limits", outcome: "pass", detail: `Length ${len} characters is within limits.` };
}
