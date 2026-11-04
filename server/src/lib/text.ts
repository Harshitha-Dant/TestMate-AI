/**
 * Text helpers for rule-based evaluation. Unicode-aware so Telugu and Devanagari text keep their
 * combining marks (\p{M}); punctuation becomes whitespace.
 */

const STOPWORDS = new Set(
  (
    "a an the and or but if then so to of in on at by for with from into onto about as is are was were be been being " +
    "it its this that these those i me my we our you your he she they them their his her do does did done have has had " +
    "can could will would should may might must shall not no yes please there here what which who whom when where why how " +
    "all any some each also just than too very up out over again once only own same such more most other am"
  ).split(" "),
);

export function normalize(text: string): string {
  return text
    .normalize("NFKC")
    // Zero-width (non-)joiners shape Indic text inside a word (e.g. ఆర్డర్‌ను); drop them rather than split the word.
    .replace(/[‌‍]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}\s]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(text: string): string[] {
  const n = normalize(text);
  return n ? n.split(" ") : [];
}

/** Distinct tokens that carry meaning: no stopwords, no single letters (single digits are kept). */
export function contentTokens(text: string): string[] {
  return [...new Set(tokenize(text).filter((t) => !STOPWORDS.has(t) && (t.length > 1 || /\p{N}/u.test(t))))];
}

/** Words shorter than this must match whole; longer ones may take a suffix. */
const MIN_PREFIX_LENGTH = 4;

/**
 * True when `phrase` occurs in `text` starting on a word boundary. A last word of 4+ characters
 * may continue (so "refund" matches "refunds" and "refunded"); shorter ones must end on a boundary
 * (so "hi" does not match "history"). Both arguments are normalized here.
 */
export function containsPhrase(text: string, phrase: string): boolean {
  const p = normalize(phrase);
  if (!p) return false;
  const haystack = ` ${normalize(text)} `;
  const lastWord = p.slice(p.lastIndexOf(" ") + 1);
  const allowSuffix = [...lastWord].length >= MIN_PREFIX_LENGTH;
  for (let i = haystack.indexOf(` ${p}`); i !== -1; i = haystack.indexOf(` ${p}`, i + 1)) {
    if (allowSuffix || haystack[i + p.length + 1] === " ") return true;
  }
  return false;
}

/** Share (0-100) of the reference's content tokens found in the candidate, allowing suffixes. */
export function tokenOverlap(candidate: string, reference: string): { score: number; missing: string[] } {
  const ref = contentTokens(reference);
  if (ref.length === 0) return { score: 100, missing: [] };
  const cand = tokenize(candidate);
  const missing = ref.filter(
    (r) => !cand.some((c) => c === r || ([...r].length >= MIN_PREFIX_LENGTH && c.startsWith(r))),
  );
  return { score: Math.round(((ref.length - missing.length) / ref.length) * 100), missing };
}

/** FNV-1a 32-bit hash mapped to [0, 1). Used for deterministic pseudo-randomness. */
export function hashUnit(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}
