import type { LanguageCheckDetails } from "@testmate/shared";
import { intentName, languageName } from "../../lib/languages";
import { LanguageDetectionView } from "../language/LanguageDetectionView";

/** Detected question/reply languages and intent for a Multilingual Lab run. */
export function LanguagePanel({ language }: { language: LanguageCheckDetails }) {
  return (
    <div className="space-y-3 rounded-xl border border-line p-3">
      <div className="grid gap-4 sm:grid-cols-2">
        <LanguageDetectionView label="Question:" detection={language.input} />
        <LanguageDetectionView label="Reply:" detection={language.output} />
      </div>
      <dl className="flex flex-wrap gap-x-6 gap-y-1 border-t border-line pt-2 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-muted">Expected reply language</dt>
          <dd>{languageName(language.expectedLanguage)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Expected intent</dt>
          <dd>{intentName(language.expectedIntent)}</dd>
        </div>
        <div className="flex gap-1.5">
          <dt className="text-muted">Detected intent</dt>
          <dd>{language.detectedIntent ? intentName(language.detectedIntent) : "Not recognized"}</dd>
        </div>
      </dl>
      <p className="text-[11px] text-muted/80">
        Heuristic: Unicode script ranges plus small Tanglish/Hinglish word lists, and keyword signatures for intents. No
        translation or meaning is involved.
      </p>
    </div>
  );
}
