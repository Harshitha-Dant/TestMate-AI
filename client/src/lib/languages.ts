import { INTENT_LABELS, LANGUAGE_SHORT_LABELS, type Intent, type Language } from "@testmate/shared";

/** BCP 47 tag for the `lang` attribute, so browsers pick the right font and shaping for Telugu and Devanagari. */
export function langAttr(language: string | null | undefined): string | undefined {
  if (!language || language === "mixed" || language === "unknown") return undefined;
  return language;
}

export function languageName(language: string | null | undefined): string {
  return language ? (LANGUAGE_SHORT_LABELS[language as Language] ?? language) : "Not set";
}

export function intentName(intent: string | null | undefined): string {
  return intent ? (INTENT_LABELS[intent as Intent] ?? intent) : "Any";
}
