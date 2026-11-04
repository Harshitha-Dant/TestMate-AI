import {
  INTENT_LABELS,
  LANGUAGE_LABELS,
  type CheckOutcome,
  type EvaluationCheck,
  type Intent,
  type Language,
  type LanguageCheckDetails,
  type LanguageDetection,
  type TestCriteria,
} from "@testmate/shared";
import { detectResponseIntent } from "../lib/intents";
import { detectLanguage, sameLanguageFamily } from "../lib/languageDetect";
import { normalize } from "../lib/text";
import { RuleBasedEvaluator } from "./ruleBasedEvaluator";
import type { EvaluationResult } from "./types";

export interface MultilingualInput {
  input: string;
  output: string;
  expected: string;
  criteria: TestCriteria;
  inputLanguage: Language | null;
  expectedLanguage: Language | null;
  expectedIntent: Intent | null;
}

const RANK: Record<CheckOutcome, number> = { skip: 0, pass: 1, review: 2, fail: 3 };
const describe = (d: LanguageDetection) =>
  d.language === "mixed" && d.primary
    ? `mixed, mostly ${LANGUAGE_LABELS[d.primary]}`
    : `${LANGUAGE_LABELS[d.language]} (${d.method === "script" ? "by script" : d.method === "lexicon" ? "by word list" : "low evidence"}, ${d.confidence} confidence)`;

/** Compares a detected language with the expected one. Same language in another script needs review. */
export function languageVerdict(expected: Language, detected: LanguageDetection): { outcome: CheckOutcome; detail: string } {
  const got = detected.language;
  if (expected === "mixed") {
    return got === "mixed"
      ? { outcome: "pass", detail: `Reply is code-mixed as expected (${describe(detected)}).` }
      : { outcome: "review", detail: `Expected a code-mixed reply, but it reads as ${describe(detected)}.` };
  }
  if (got === expected) return { outcome: "pass", detail: `Reply is in ${describe(detected)}.` };
  if (got === "unknown") return { outcome: "review", detail: "Couldn't identify the reply's language." };
  if (got === "mixed") {
    return detected.primary === expected
      ? { outcome: "review", detail: `Reply is mostly ${LANGUAGE_LABELS[expected]} but mixed with other languages.` }
      : { outcome: "fail", detail: `Wrong language: expected ${LANGUAGE_LABELS[expected]}, reply is ${describe(detected)}.` };
  }
  if (sameLanguageFamily(expected, got)) {
    return {
      outcome: "review",
      detail: `Right language, different script: expected ${LANGUAGE_LABELS[expected]}, reply is ${LANGUAGE_LABELS[got]}.`,
    };
  }
  return { outcome: "fail", detail: `Wrong language: expected ${LANGUAGE_LABELS[expected]}, reply is ${describe(detected)}.` };
}

/**
 * Rule-based multilingual evaluator: the standard keyword/relevance/length checks plus
 * reply-language, expected-intent and declared-input-language checks. Language and intent come from
 * the heuristics in languageDetect.ts and intents.ts; no translation or semantic understanding is involved.
 */
export class MultilingualEvaluator {
  readonly name = "rule-based" as const;
  private readonly base = new RuleBasedEvaluator();

  evaluate(i: MultilingualInput): EvaluationResult & { language: LanguageCheckDetails } {
    const baseResult = this.base.evaluate({ output: i.output, expected: i.expected, criteria: i.criteria });
    const inputDetection = detectLanguage(i.input);
    const outputDetection = detectLanguage(i.output);
    const detectedIntent = detectResponseIntent(i.output);
    const empty = normalize(i.output) === "";
    const checks: EvaluationCheck[] = [...baseResult.checks];

    if (i.expectedLanguage && !empty) {
      const v = languageVerdict(i.expectedLanguage, outputDetection);
      checks.push({ id: "language", label: "Reply language", ...v });
    } else {
      checks.push({
        id: "language",
        label: "Reply language",
        outcome: "skip",
        detail: empty ? "No reply to check." : "No expected language set.",
      });
    }

    if (i.expectedIntent && !empty) {
      const expected = INTENT_LABELS[i.expectedIntent];
      checks.push({
        id: "intent",
        label: "Answers the expected intent",
        ...(detectedIntent === i.expectedIntent
          ? { outcome: "pass" as const, detail: `Reply matches the "${expected}" intent.` }
          : detectedIntent
            ? { outcome: "fail" as const, detail: `Reply answers "${INTENT_LABELS[detectedIntent]}" instead of "${expected}".` }
            : { outcome: "review" as const, detail: `Couldn't recognize which intent the reply answers (expected "${expected}").` }),
      });
    } else {
      checks.push({ id: "intent", label: "Answers the expected intent", outcome: "skip", detail: "No expected intent set." });
    }

    if (i.inputLanguage) {
      const v = languageVerdict(i.inputLanguage, inputDetection);
      checks.push({
        id: "input_language",
        label: "Question matches its declared language",
        outcome: v.outcome === "pass" ? "pass" : "review",
        detail:
          v.outcome === "pass"
            ? `Question detected as ${describe(inputDetection)}.`
            : `The test says the question is ${LANGUAGE_LABELS[i.inputLanguage]}, but it looks like ${describe(inputDetection)}. Check the test.`,
      });
    }

    const worst = checks.reduce<CheckOutcome>((a, c) => (RANK[c.outcome] > RANK[a] ? c.outcome : a), "skip");
    const graded = checks.filter((c) => c.outcome !== "skip");
    const score = Math.round(
      graded.reduce((sum, c) => sum + (c.score ?? (c.outcome === "pass" ? 100 : c.outcome === "review" ? 50 : 0)), 0) /
        Math.max(graded.length, 1),
    );
    const problems = checks.filter((c) => c.outcome === "fail" || c.outcome === "review").map((c) => c.detail);

    return {
      status: worst === "fail" ? "failed" : worst === "review" ? "needs_review" : "passed",
      score,
      checks,
      explanation: problems.length ? problems.join(" ") : "All rule-based checks passed.",
      language: {
        input: inputDetection,
        output: outputDetection,
        expectedLanguage: i.expectedLanguage,
        expectedIntent: i.expectedIntent,
        detectedIntent,
      },
    };
  }
}
