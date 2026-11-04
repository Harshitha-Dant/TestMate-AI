import { INTENTS, type Intent } from "@testmate/shared";
import { containsPhrase } from "./text";

/**
 * Phrases that show which intent a reply answers, in English, Telugu, Hindi and romanized forms.
 * Matching uses the same normalized, word-boundary rules as the keyword checks. Heuristic only.
 */
const RESPONSE_SIGNATURES: Record<Intent, string[]> = {
  order_status: ["track", "status", "ట్రాక్", "స్థితి", "ट्रैक", "स्थिति"],
  refund: ["refund", "రీఫండ్", "रिफंड"],
  delivery_time: ["express", "3-5", "ఎక్స్‌ప్రెస్", "एक्सप्रेस"],
  cancel_order: ["cancel", "24", "రద్దు", "रद्द"],
  payment_methods: ["upi", "net banking", "debit", "నెట్ బ్యాంకింగ్", "డెబిట్", "नेट बैंकिंग", "डेबिट"],
  password_reset: ["password", "పాస్‌వర్డ్", "पासवर्ड"],
  support_hours: ["monday", "9 am", "support team", "సోమవారం", "సపోర్ట్ టీమ్", "सोमवार", "सपोर्ट टीम"],
  greeting: ["hello", "namaskaram", "namaste", "how can i help", "నమస్కారం", "ఎలా సహాయం", "नमस्ते", "कैसे मदद"],
};

/** The intent a reply most likely answers (most signature hits; earlier intents win ties), or null. */
export function detectResponseIntent(reply: string): Intent | null {
  let best: { intent: Intent; hits: number } | null = null;
  for (const intent of INTENTS) {
    const hits = RESPONSE_SIGNATURES[intent].filter((s) => containsPhrase(reply, s)).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { intent, hits };
  }
  return best?.intent ?? null;
}
