import { describe, expect, it } from "vitest";
import { detectResponseIntent } from "../src/lib/intents";
import { detectLanguage, sameLanguageFamily } from "../src/lib/languageDetect";
import { containsPhrase, normalize } from "../src/lib/text";

const lang = (t: string) => detectLanguage(t).language;

describe("detectLanguage", () => {
  it("identifies the four sample order-status questions", () => {
    expect(lang("Where is my order?")).toBe("en");
    expect(lang("నా ఆర్డర్ ఎక్కడ ఉంది?")).toBe("te");
    expect(lang("Naa order ekkada undi?")).toBe("te-Latn");
    expect(lang("मेरा ऑर्डर कहाँ है?")).toBe("hi");
    expect(lang("Mera order kahan hai?")).toBe("hi-Latn");
  });

  it("reports method, confidence, composition and evidence", () => {
    const te = detectLanguage("నా ఆర్డర్ ఎక్కడ ఉంది?");
    expect(te).toMatchObject({ method: "script", confidence: "high", composition: { te: 100, hi: 0, en: 0 } });
    const tanglish = detectLanguage("Naa order ekkada undi?");
    expect(tanglish).toMatchObject({ method: "lexicon", confidence: "high", evidence: ["naa", "ekkada", "undi"] });
    expect(tanglish.composition).toEqual({ te: 75, hi: 0, en: 25 });
    expect(detectLanguage("Where is my order?")).toMatchObject({ language: "en", method: "lexicon", confidence: "high" });
    // Single letters must not count as English words (guards against the word list being split into characters).
    expect(detectLanguage("x y z")).toMatchObject({ language: "en", method: "none", confidence: "low" });
  });

  it("detects code-mixed text and its main language", () => {
    const mixed = detectLanguage("నా order status ఏంటి? Please చెప్పండి");
    expect(mixed).toMatchObject({ language: "mixed", primary: "te" });
    expect(detectLanguage("Mera order ఎక్కడ ఉంది?")).toMatchObject({ language: "mixed", primary: "te" });
    // A single English loanword in Telugu script text is not "mixed".
    expect(lang("మీ ఆర్డర్‌ను My Orders లో ట్రాక్ చేయవచ్చు, తాజా స్థితిని చూడండి")).toBe("te");
  });

  it("keeps Tanglish with English nouns as Tanglish", () => {
    expect(lang("Mee order ni My Orders lo track cheyyochu. Order open chesi latest status chudandi.")).toBe("te-Latn");
    expect(lang("Aap apna order My Orders mein track kar sakte hain.")).toBe("hi-Latn");
  });

  it("handles empty and unrecognizable input", () => {
    expect(detectLanguage("")).toMatchObject({ language: "unknown", method: "none", primary: null });
    expect(detectLanguage("12345 ???")).toMatchObject({ language: "unknown" });
    expect(detectLanguage("Xyzzy")).toMatchObject({ language: "en", confidence: "low" });
  });

  it("treats native and romanized forms as one language family", () => {
    expect(sameLanguageFamily("te", "te-Latn")).toBe(true);
    expect(sameLanguageFamily("hi", "te")).toBe(false);
    expect(sameLanguageFamily("mixed", "mixed")).toBe(false);
  });
});

describe("Indic text normalization", () => {
  it("drops zero-width joiners instead of splitting words", () => {
    expect(normalize("ఆర్డర్‌ను")).toBe("ఆర్డర్ను");
    expect(containsPhrase("మీ ఆర్డర్‌ను ట్రాక్ చేయండి", "ఆర్డర్")).toBe(true);
  });
});

describe("detectResponseIntent", () => {
  it("recognizes intents across languages", () => {
    expect(detectResponseIntent("You can track your order from My Orders.")).toBe("order_status");
    expect(detectResponseIntent("మీ ఆర్డర్‌ను ట్రాక్ చేయవచ్చు")).toBe("order_status");
    expect(detectResponseIntent("रिफंड 5-7 कार्यदिवसों में आ जाएगा")).toBe("refund");
    expect(detectResponseIntent("Standard delivery takes 3-5 business days.")).toBe("delivery_time");
    expect(detectResponseIntent("We accept UPI and cash on delivery.")).toBe("payment_methods");
    expect(detectResponseIntent("I can't help with that.")).toBeNull();
  });
});
