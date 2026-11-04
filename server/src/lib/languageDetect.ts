/**
 * Heuristic language identification for English, Telugu, Hindi and their romanized forms.
 *  1. Script: Telugu (U+0C00–0C7F) and Devanagari (U+0900–097F) words are counted by Unicode range.
 *  2. Romanized text: small word lists of common Tanglish / Hinglish function words and verbs.
 *  3. Everything else written in Latin letters counts as English.
 * This is a transparent heuristic, not a trained model: short or unusual text can be misread.
 */
import type { Language, LanguageDetection, LanguageFamily } from "@testmate/shared";
import { normalize } from "./text";

const TELUGU = /[ఀ-౿]/u;
const DEVANAGARI = /[ऀ-ॿ]/u;
const LATIN = /\p{Script=Latin}/u;

/** Common romanized Telugu words (Tanglish). Kept free of English and Hinglish look-alikes. */
export const TELUGU_ROMAN = new Set(
  (
    "naa naaku nenu memu meeru mee maa nuvvu neeku ekkada undi unnadi unnayi untundi ledu leda emi enti endi ela elaa " +
    "eppudu entha enni cheppandi cheppu kavali kaavali chesanu chesina chesi cheyyali cheyyochu cheyandi cheyyandi " +
    "cheyyadaniki cheyagalanu cheyyagalanu chestamu chudandi chupinchandi vastundi vachindi vachina raledu ivvandi " +
    "ivvali dabbulu rojulu lo ni nunchi nundi kosam gurinchi inka chala bagundi andi avunu kaadu sare ippudu tho " +
    "adi idi vaapasu tirigi pampandi padutundi lopu ayina tarvata varaku namaskaram daani daggara dayachesi malli " +
    "adagandi vishayam raddu"
  ).split(" "),
);

/** Common romanized Hindi words (Hinglish). Kept free of English and Tanglish look-alikes. */
export const HINDI_ROMAN = new Set(
  (
    "mera meri mere mujhe mujhko hum hamara hamari aap aapka aapki aapke apna apni apne kahan kahaan kya kyun kaise kab " +
    "kitna kitne kitni hai hain hoga hogi hoon nahi nahin chahiye karna karne karo kijiye karein kar karte raha rahi " +
    "rahe gaya gayi abhi tak se ka ke ko liye aur bhi kuch yeh woh mein paisa paise wapas milega milenge din dijiye " +
    "batao bataiye sakte sakta sakti jayega jaayega lagte pahunchti dekhiye kholkar madad namaste subah baje raat " +
    "chuniye aaye maaf iske baare paas jaankari kripya dobara poochiye ghante andar hone baad radd bhugtan aayega aayegi"
  ).split(" "),
);

/** Frequent English words, used to raise confidence that Latin text is English. */
const ENGLISH_COMMON = new Set(
  (
    "the a an is are was were be been my your you i me we our it this that these where what when how why which who " +
    "can could will would should do does did to of in on for with and or not no yes please thanks thank hello hi " +
    "order orders refund delivery payment help track status days business account password cancel about from " +
    "get have has go there here want need"
  ).split(" "),
);

const pct = (n: number, total: number) => (total ? Math.round((n / total) * 100) : 0);

export function detectLanguage(text: string): LanguageDetection {
  const tokens = normalize(text)
    .split(" ")
    .filter((t) => /\p{L}/u.test(t));
  const scripts = { telugu: 0, devanagari: 0, latin: 0 };
  let teRoman = 0;
  let hiRoman = 0;
  let english = 0;
  let otherLatin = 0;
  const evidence: string[] = [];

  for (const t of tokens) {
    if (TELUGU.test(t)) scripts.telugu++;
    else if (DEVANAGARI.test(t)) scripts.devanagari++;
    else if (LATIN.test(t)) {
      scripts.latin++;
      if (TELUGU_ROMAN.has(t)) {
        teRoman++;
        evidence.push(t);
      } else if (HINDI_ROMAN.has(t)) {
        hiRoman++;
        evidence.push(t);
      } else if (ENGLISH_COMMON.has(t)) english++;
      else otherLatin++;
    }
  }

  const total = tokens.length;
  const family = { te: scripts.telugu + teRoman, hi: scripts.devanagari + hiRoman, en: english + otherLatin };
  const composition: Record<LanguageFamily, number> = {
    en: pct(family.en, total),
    te: pct(family.te, total),
    hi: pct(family.hi, total),
  };
  const result = (
    language: Language,
    method: LanguageDetection["method"],
    confidence: LanguageDetection["confidence"],
    primary: Language | null = language,
  ): LanguageDetection => ({ language, primary, confidence, method, composition, scripts, evidence: [...new Set(evidence)] });

  if (total === 0) return result("unknown", "none", "low", null);

  /** Maps the largest family to a concrete language, preferring native script when present. */
  const primaryOf = (nativeFirst: "te" | "hi" | null): Language => {
    const order: LanguageFamily[] = (["te", "hi", "en"] as LanguageFamily[]).sort(
      (a, b) => family[b] - family[a] || (a === nativeFirst ? -1 : b === nativeFirst ? 1 : 0),
    );
    const top = order[0]!;
    if (top === "te") return scripts.telugu > 0 ? "te" : "te-Latn";
    if (top === "hi") return scripts.devanagari > 0 ? "hi" : "hi-Latn";
    return "en";
  };

  const native = scripts.telugu + scripts.devanagari;
  if (native > 0) {
    const nativeLang = scripts.telugu >= scripts.devanagari ? "te" : "hi";
    const minorNative = Math.min(scripts.telugu, scripts.devanagari);
    const bothScripts = minorNative > 0 && minorNative / native >= 0.25;
    const latinShare = scripts.latin / total;
    if (bothScripts || latinShare >= 0.4) return result("mixed", "script", "medium", primaryOf(nativeLang));
    return result(nativeLang, "script", native / total >= 0.8 ? "high" : "medium");
  }

  // Only Latin letters: decide between Tanglish, Hinglish and English from the word lists.
  const isTe = teRoman >= 2 || (teRoman === 1 && total <= 3);
  const isHi = hiRoman >= 2 || (hiRoman === 1 && total <= 3);
  if (isTe && isHi) {
    if (teRoman >= 2 * hiRoman) return result("te-Latn", "lexicon", "medium");
    if (hiRoman >= 2 * teRoman) return result("hi-Latn", "lexicon", "medium");
    return result("mixed", "lexicon", "low", primaryOf(null));
  }
  if (isTe) return result("te-Latn", "lexicon", teRoman >= 3 ? "high" : "medium");
  if (isHi) return result("hi-Latn", "lexicon", hiRoman >= 3 ? "high" : "medium");
  if (english > 0) return result("en", "lexicon", english / total >= 0.25 ? "high" : "medium");
  return result("en", "none", "low");
}

/** te and te-Latn (or hi and hi-Latn) are the same language in different scripts. */
export function sameLanguageFamily(a: Language, b: Language): boolean {
  return a.split("-")[0] === b.split("-")[0] && a !== "mixed" && a !== "unknown";
}
