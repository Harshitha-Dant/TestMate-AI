import type { Language } from "./domain";

/** Languages a test can be written in or expect a reply in. "-Latn" = romanized (Tanglish / Hinglish). */
export const TEST_LANGUAGES = ["en", "te", "te-Latn", "hi", "hi-Latn", "mixed"] as const;
export type TestLanguage = (typeof TEST_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  te: "Telugu",
  "te-Latn": "Tanglish (romanized Telugu)",
  hi: "Hindi",
  "hi-Latn": "Hinglish (romanized Hindi)",
  mixed: "Mixed",
  unknown: "Unknown",
};

export const LANGUAGE_SHORT_LABELS: Record<Language, string> = {
  en: "English",
  te: "Telugu",
  "te-Latn": "Tanglish",
  hi: "Hindi",
  "hi-Latn": "Hinglish",
  mixed: "Mixed",
  unknown: "Unknown",
};

/** Language families used for composition percentages (script + romanized words combined). */
export type LanguageFamily = "en" | "te" | "hi";

export interface LanguageDetection {
  language: Language;
  /** For mixed text: the language with the largest share. Otherwise the same as `language`. */
  primary: Language | null;
  confidence: "high" | "medium" | "low";
  /** script: Unicode ranges decided it. lexicon: romanized/English word lists decided it. */
  method: "script" | "lexicon" | "none";
  /** Percent of words per language family (0-100). */
  composition: Record<LanguageFamily, number>;
  /** Word counts per script. */
  scripts: { telugu: number; devanagari: number; latin: number };
  /** Romanized Telugu/Hindi words that matched the lexicon. */
  evidence: string[];
}

export const INTENTS = [
  "order_status",
  "refund",
  "delivery_time",
  "cancel_order",
  "payment_methods",
  "password_reset",
  "support_hours",
  "greeting",
] as const;
export type Intent = (typeof INTENTS)[number];

export const INTENT_LABELS: Record<Intent, string> = {
  order_status: "Order status",
  refund: "Refund",
  delivery_time: "Delivery time",
  cancel_order: "Cancel order",
  payment_methods: "Payment methods",
  password_reset: "Password reset",
  support_hours: "Support hours",
  greeting: "Greeting",
};

export interface LanguageCheckDetails {
  input: LanguageDetection;
  output: LanguageDetection;
  expectedLanguage: Language | null;
  expectedIntent: Intent | null;
  /** Intent the reply appears to answer, from multilingual keyword signatures. */
  detectedIntent: Intent | null;
}

export interface LanguageSummaryRow {
  /** The test's input language. */
  language: Language;
  cases: number;
  /** Cases with at least one run (latest run counted). */
  run: number;
  passed: number;
  failed: number;
  needsReview: number;
  errors: number;
  /** Latest runs whose reply was in the wrong language. */
  wrongLanguage: number;
  passRate: number | null;
  avgScore: number | null;
}
