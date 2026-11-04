/**
 * Heuristic fact extraction for multi-turn tests (English phrasing only).
 * The user side finds facts people state ("My name is Ravi", "I moved to Chennai"); the bot side
 * finds facts the bot asserts back ("Your name is Ravi", "You live in Chennai").
 * Used by both the simulated bot (to "remember") and the evaluator (to spot contradictions).
 */
import { normalize } from "./text";

export interface ExtractedFact {
  slot: string;
  value: string;
}

/** Words that end a captured value: "Bengaluru last month" → "Bengaluru". */
const VALUE_STOPWORDS = new Set(
  "and but so now too please also then last since from in at for today yesterday month week year anymore though".split(" "),
);

/** Keeps up to three words, stopping at punctuation or a stopword. */
export function cleanValue(raw: string): string {
  const out: string[] = [];
  for (const word of raw.trim().split(/\s+/)) {
    const bare = word.replace(/[.,!?;:"')]+$/u, "");
    if (!bare || VALUE_STOPWORDS.has(bare.toLowerCase())) break;
    out.push(bare);
    if (bare !== word || out.length >= 3) break;
  }
  return out.join(" ");
}

const ORDER_ID = String.raw`#?([A-Za-z0-9-]*\d[A-Za-z0-9-]*)`;
const KNOWN_SLOT_WORDS = new Set(["name", "city", "order number", "order id", "order no"]);

type Pattern = { slot: string; re: RegExp; direct?: boolean };

const USER_PATTERNS: Pattern[] = [
  { slot: "name", re: /\bmy name is (.+)/i },
  { slot: "name", re: /\bcall me (.+)/i },
  { slot: "name", re: /\b[Ii](?: am|'m) (\p{Lu}.*)/u },
  { slot: "city", re: /\bi (?:live|stay) in (.+)/i },
  { slot: "city", re: /\bi(?: am|'m) from (.+)/i },
  { slot: "city", re: /\bi (?:moved|relocated|shifted) to (.+)/i },
  { slot: "city", re: /\bmy city is (.+)/i },
  { slot: "order number", re: new RegExp(String.raw`\border (?:number|no\.?|id)(?: is)?:?\s*${ORDER_ID}`, "i"), direct: true },
];

const BOT_PATTERNS: Pattern[] = [
  { slot: "name", re: /\byour name is (.+)/i },
  // No `i` flag: the name must start with a capital, so "Hi there" is not read as a name.
  { slot: "name", re: /\b(?:[Nn]ice to meet you|[Hh]ello|[Hh]i|[Ww]elcome back),? (\p{Lu}.*)/u },
  { slot: "city", re: /\byou (?:live|stay) in (.+)/i },
  { slot: "city", re: /\byou(?:'re| are) from (.+)/i },
  { slot: "city", re: /\byour city is (.+)/i },
  { slot: "order number", re: new RegExp(String.raw`\border (?:number|no\.?|id) is:?\s*${ORDER_ID}`, "i"), direct: true },
  { slot: "order number", re: new RegExp(String.raw`\bnoted order ${ORDER_ID}`, "i"), direct: true },
];

const GENERIC_USER = /\bmy ((?:\p{L}+ ){0,2}\p{L}+) is (.+)/iu;
const GENERIC_BOT = /\byour ((?:\p{L}+ ){0,2}\p{L}+) is (.+)/iu;

function extract(text: string, patterns: Pattern[], generic: RegExp): ExtractedFact[] {
  const facts = new Map<string, string>();
  for (const { slot, re, direct } of patterns) {
    if (facts.has(slot)) continue;
    const m = re.exec(text);
    const value = m?.[1] && (direct ? m[1].replace(/[.,!?]+$/, "") : cleanValue(m[1]));
    if (value) facts.set(slot, value);
  }
  const g = generic.exec(text);
  if (g?.[1] && g[2]) {
    const slot = g[1].toLowerCase();
    const value = cleanValue(g[2]);
    if (!KNOWN_SLOT_WORDS.has(slot) && !facts.has(slot) && value) facts.set(slot, value);
  }
  return [...facts].map(([slot, value]) => ({ slot, value }));
}

export const extractUserFacts = (text: string) => extract(text, USER_PATTERNS, GENERIC_USER);
export const extractBotFacts = (text: string) => extract(text, BOT_PATTERNS, GENERIC_BOT);

const RECALL_PATTERNS: { slot: string; re: RegExp }[] = [
  { slot: "name", re: /\b(?:what(?:'s| is) my name|who am i|do you (?:know|remember) my name)/i },
  { slot: "city", re: /\b(?:where do i (?:live|stay)|which city (?:do i|am i)|where am i from|what(?:'s| is) my city)/i },
  { slot: "order number", re: /\b(?:what(?:'s| is) my order (?:number|no|id)|do you (?:know|remember) my order)/i },
];

/** The fact slot a question asks the bot to recall, or null. */
export function recallSlot(question: string): string | null {
  for (const { slot, re } of RECALL_PATTERNS) if (re.test(question)) return slot;
  const g = /\bwhat(?:'s| is) my ((?:\p{L}+ ){0,2}\p{L}+)\s*\??\s*$/iu.exec(question.trim());
  return g?.[1] ? g[1].toLowerCase() : null;
}

/** Phrases a bot uses when it has lost the context. */
export function signalsForgetting(reply: string): boolean {
  return /\b(?:don't|do not|can't|cannot) (?:remember|recall|know)|not sure|could you (?:tell|remind) me|don't have (?:that|information)/i.test(
    reply,
  );
}

export function sameValue(a: string, b: string): boolean {
  return normalize(a) === normalize(b);
}
