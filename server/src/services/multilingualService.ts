import {
  DEFAULT_CRITERIA,
  TEST_LANGUAGES,
  type Intent,
  type Language,
  type LanguageSummaryRow,
  type TestLanguage,
} from "@testmate/shared";
import type { Db } from "../db/connection";
import { executionRepo } from "../db/repositories/executionRepo";
import { suiteRepo } from "../db/repositories/suiteRepo";
import { testCaseRepo } from "../db/repositories/testCaseRepo";

export const SAMPLE_SUITE_NAME = "Order status in 4 languages";

interface Sample {
  title: string;
  input: string;
  inputLanguage: TestLanguage;
  expectedLanguage: TestLanguage;
  expectedIntent: Intent;
}

/** The brief's sample scenarios, plus a refund question and a code-mixed message. */
export const MULTILINGUAL_SAMPLES: Sample[] = [
  { title: "Order status · English", input: "Where is my order?", inputLanguage: "en", expectedLanguage: "en", expectedIntent: "order_status" },
  { title: "Order status · Telugu", input: "నా ఆర్డర్ ఎక్కడ ఉంది?", inputLanguage: "te", expectedLanguage: "te", expectedIntent: "order_status" },
  { title: "Order status · Tanglish", input: "Naa order ekkada undi?", inputLanguage: "te-Latn", expectedLanguage: "te-Latn", expectedIntent: "order_status" },
  { title: "Order status · Hindi", input: "मेरा ऑर्डर कहाँ है?", inputLanguage: "hi", expectedLanguage: "hi", expectedIntent: "order_status" },
  { title: "Order status · Hinglish", input: "Mera order kahan hai?", inputLanguage: "hi-Latn", expectedLanguage: "hi-Latn", expectedIntent: "order_status" },
  { title: "Refund · Telugu", input: "నాకు రీఫండ్ ఎప్పుడు వస్తుంది?", inputLanguage: "te", expectedLanguage: "te", expectedIntent: "refund" },
  { title: "Refund · Hinglish", input: "Mujhe refund kab milega?", inputLanguage: "hi-Latn", expectedLanguage: "hi-Latn", expectedIntent: "refund" },
  {
    title: "Code-mixed Telugu + English",
    input: "నా order status ఏంటి? Please చెప్పండి",
    inputLanguage: "mixed",
    expectedLanguage: "te",
    expectedIntent: "order_status",
  },
];

export const multilingualService = {
  /** Adds the sample scenarios to the sample suite (creating it if needed). Returns ids of new cases. */
  addSamples(db: Db, projectId: number, opts: { isDemo?: boolean } = {}): { suiteId: number; created: number[] } {
    return db.transaction(() => {
      const suiteId =
        suiteRepo.findByName(db, projectId, "multilingual", SAMPLE_SUITE_NAME)?.id ??
        suiteRepo.create(db, projectId, "multilingual", {
          name: SAMPLE_SUITE_NAME,
          description: "The same questions in English, Telugu, Tanglish, Hindi and Hinglish.",
        });
      const existing = new Set(testCaseRepo.list(db, projectId, { module: "multilingual", suiteId }).map((c) => c.title));
      const created = MULTILINGUAL_SAMPLES.filter((s) => !existing.has(s.title)).map((s) =>
        testCaseRepo.create(db, projectId, "multilingual", {
          ...s,
          suiteId,
          expected: "",
          criteria: DEFAULT_CRITERIA,
          isDemo: opts.isDemo,
        }),
      );
      return { suiteId, created };
    })();
  },

  /** Per input language: latest-run outcomes of every multilingual case. */
  summary(db: Db, projectId: number): LanguageSummaryRow[] {
    const cases = testCaseRepo.list(db, projectId, { module: "multilingual" });
    const rows = new Map<Language, LanguageSummaryRow & { scoreSum: number; scored: number }>();
    for (const c of cases) {
      const language = (c.inputLanguage ?? c.expectedLanguage ?? "unknown") as Language;
      const row =
        rows.get(language) ??
        { language, cases: 0, run: 0, passed: 0, failed: 0, needsReview: 0, errors: 0, wrongLanguage: 0, passRate: null, avgScore: null, scoreSum: 0, scored: 0 };
      rows.set(language, row);
      row.cases++;
      if (!c.lastRun) continue;
      const exec = executionRepo.get(db, projectId, c.lastRun.executionId);
      if (!exec) continue;
      row.run++;
      if (exec.effectiveStatus === "passed") row.passed++;
      else if (exec.effectiveStatus === "failed") row.failed++;
      else if (exec.effectiveStatus === "needs_review") row.needsReview++;
      else row.errors++;
      if (exec.details.checks?.some((ch) => ch.id === "language" && ch.outcome === "fail")) row.wrongLanguage++;
      if (exec.score !== null) {
        row.scoreSum += exec.score;
        row.scored++;
      }
    }
    const order: string[] = [...TEST_LANGUAGES, "unknown"];
    return [...rows.values()]
      .sort((a, b) => order.indexOf(a.language) - order.indexOf(b.language))
      .map(({ scoreSum, scored, ...row }) => ({
        ...row,
        passRate: row.run ? Math.round((row.passed / row.run) * 100) : null,
        avgScore: scored ? Math.round(scoreSum / scored) : null,
      }));
  },
};
