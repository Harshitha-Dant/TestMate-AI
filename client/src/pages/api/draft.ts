import { SECRET_MASK, type ApiHistoryEntry, type ApiRequestInput, type AssertionType, type FieldAssertion, type HttpMethod } from "@testmate/shared";

export type RequestDraft = ApiRequestInput;

export const EMPTY_DRAFT: RequestDraft = {
  name: "",
  method: "GET",
  url: "",
  headers: [{ key: "Accept", value: "application/json", enabled: true }],
  bodyType: "none",
  body: "",
  expectations: { status: null, maxTimeMs: null, fields: [] },
  suiteId: null,
};

/**
 * Turns a stored (masked) entry back into an editable draft. Masked secret values can't be re-sent,
 * so header values are cleared and the caller is told which fields need re-entering.
 */
export function draftFromEntry(entry: ApiHistoryEntry): { draft: RequestDraft; needsSecrets: string[] } {
  const needsSecrets: string[] = [];
  const headers = entry.headers.map((h) => {
    if (!h.value.includes(SECRET_MASK)) return h;
    needsSecrets.push(`header "${h.key}"`);
    return { ...h, value: "" };
  });
  if (entry.url.includes(SECRET_MASK)) needsSecrets.push("a URL query value");
  if (entry.body.includes(SECRET_MASK)) needsSecrets.push("a value in the body");
  return {
    draft: {
      name: entry.name,
      method: entry.method,
      url: entry.url,
      headers,
      bodyType: entry.bodyType,
      body: entry.body,
      expectations: entry.expectations,
      suiteId: entry.suiteId,
    },
    needsSecrets,
  };
}

export const METHOD_TONE: Record<HttpMethod, string> = {
  GET: "text-success",
  POST: "text-accent",
  PUT: "text-warning",
  DELETE: "text-failure",
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/** Pretty-prints JSON text; returns the input unchanged when it isn't JSON. */
export function prettyJson(text: string): { text: string; isJson: boolean } {
  try {
    return { text: JSON.stringify(JSON.parse(text), null, 2), isJson: true };
  } catch {
    return { text, isJson: false };
  }
}

/** Short "host/path" label for lists. */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

function typeOf(value: unknown): AssertionType {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean" || t === "object" ? t : "any";
}

/** Suggests "field exists with type" checks for the top-level keys of the last JSON response. */
export function suggestFields(responseBody: string | undefined, existing: FieldAssertion[]): FieldAssertion[] {
  if (!responseBody) return [];
  let doc: unknown;
  try {
    doc = JSON.parse(responseBody);
  } catch {
    return [];
  }
  const root = Array.isArray(doc) ? doc[0] : doc;
  const prefix = Array.isArray(doc) ? "[0]." : "";
  if (!root || typeof root !== "object") return [];
  const have = new Set(existing.map((f) => f.path));
  return Object.entries(root as Record<string, unknown>)
    .slice(0, 10)
    .map(([k, v]) => ({ path: `${prefix}${k}`, type: typeOf(v), equals: null }))
    .filter((f) => !have.has(f.path));
}
