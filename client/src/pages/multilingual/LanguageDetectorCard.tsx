import type { LanguageDetection } from "@testmate/shared";
import { ScanSearch } from "lucide-react";
import { useState, type FormEvent } from "react";
import { errorMessage } from "../../api/client";
import { multilingualApi } from "../../api/multilingual";
import { LanguageDetectionView } from "../../components/language/LanguageDetectionView";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader } from "../../components/ui/Card";

const EXAMPLES = ["Where is my order?", "నా ఆర్డర్ ఎక్కడ ఉంది?", "Naa order ekkada undi?", "मेरा ऑर्डर कहाँ है?", "Mera order kahan hai?", "నా order status ఏంటి? Please చెప్పండి"];

/** Try the language heuristic on any text, to see exactly how replies will be classified. */
export function LanguageDetectorCard() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<LanguageDetection | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function detect(value: string, e?: FormEvent) {
    e?.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      setResult(await multilingualApi.detect(value));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <CardHeader title="Language detector" hint="Script ranges + small romanized word lists. Heuristic, not a model." />
      <form onSubmit={(e) => detect(text, e)} className="mt-4 space-y-2">
        <label htmlFor="detect-text" className="sr-only">
          Text to detect
        </label>
        <textarea
          id="detect-text"
          value={text}
          maxLength={5000}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a question or reply…"
          className="min-h-16 w-full rounded-xl border border-line-strong bg-bg/60 px-3 py-2 text-sm placeholder:text-muted/60 focus:border-accent/60 focus:outline-none"
        />
        <div className="flex flex-wrap items-center gap-1.5">
          <Button size="sm" type="submit" loading={busy} disabled={!text.trim()} icon={<ScanSearch className="size-3.5" aria-hidden />}>
            Detect
          </Button>
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => {
                setText(ex);
                void detect(ex);
              }}
              className="max-w-40 truncate rounded-lg border border-line px-2 py-1 text-[11px] text-muted transition-colors hover:border-line-strong hover:text-fg"
            >
              {ex}
            </button>
          ))}
        </div>
      </form>
      {error && <p className="mt-3 text-sm text-failure">{error}</p>}
      {result && (
        <div className="mt-4 border-t border-line pt-4">
          <LanguageDetectionView detection={result} />
        </div>
      )}
    </Card>
  );
}
