import { isSecretName, SECRET_MASK, type HeaderEntry } from "@testmate/shared";
import { SafeHttpError } from "./safeHttp/errors";

/**
 * Secret handling for API Studio.
 *  - Values whose header/query name looks secret are masked before storage and display.
 *  - {{secret:NAME}} placeholders are resolved at send time from the server env var TESTMATE_SECRET_NAME,
 *    so real secrets never reach the database or the browser. Only TESTMATE_SECRET_* variables are readable.
 */

const PLACEHOLDER = /\{\{\s*secret:([A-Za-z0-9_]+)\s*\}\}/g;
const ONLY_PLACEHOLDERS = /^(\s*(Bearer|Basic|Token)?\s*\{\{\s*secret:[A-Za-z0-9_]+\s*\}\}\s*)+$/i;

export { isSecretName };

/** "Bearer abc123" → "Bearer ••••••••"; placeholders are not secret and are kept as-is. */
export function maskValue(value: string): string {
  if (!value || ONLY_PLACEHOLDERS.test(value)) return value;
  const scheme = /^(Bearer|Basic|Token|Digest)\s+/i.exec(value);
  return scheme ? `${scheme[1]} ${SECRET_MASK}` : SECRET_MASK;
}

export function maskHeaders(headers: HeaderEntry[]): HeaderEntry[] {
  return headers.map((h) => (isSecretName(h.key) ? { ...h, value: maskValue(h.value) } : h));
}

export function maskHeaderPairs(pairs: [string, string][]): [string, string][] {
  return pairs.map(([k, v]) => (isSecretName(k) ? [k, maskValue(v)] : [k, v]));
}

/** Masks secret-like query parameter values: ?api_key=abc → ?api_key=•••••••• */
export function maskUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }
  let changed = false;
  for (const [key, value] of url.searchParams) {
    if (isSecretName(key) && value && !ONLY_PLACEHOLDERS.test(value)) {
      url.searchParams.set(key, SECRET_MASK);
      changed = true;
    }
  }
  return changed ? url.toString().replaceAll(encodeURIComponent(SECRET_MASK), SECRET_MASK) : raw;
}

/**
 * Masks string values under secret-like keys in a JSON document ({"password": "x"} → {"password": "••••••••"}).
 * Non-JSON text is returned unchanged.
 */
export function maskJsonSecrets(text: string): string {
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch {
    return text;
  }
  let changed = false;
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node).map(([k, v]) => {
          if (isSecretName(k) && (typeof v === "string" || typeof v === "number") && !ONLY_PLACEHOLDERS.test(String(v))) {
            changed = true;
            return [k, SECRET_MASK];
          }
          return [k, walk(v)];
        }),
      );
    }
    return node;
  };
  const masked = walk(doc);
  return changed ? JSON.stringify(masked, null, 2) : text;
}

/** True when a value is a masked leftover that must not be sent. */
export function containsMask(value: string): boolean {
  return value.includes(SECRET_MASK);
}

/** Replaces {{secret:NAME}} with process.env.TESTMATE_SECRET_NAME; throws a clear error if unset. */
export function resolveSecrets(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(PLACEHOLDER, (_m, name: string) => {
    const resolved = env[`TESTMATE_SECRET_${name}`];
    if (resolved === undefined || resolved === "") {
      throw new SafeHttpError(
        "missing_secret",
        `Secret "${name}" is not set. Add TESTMATE_SECRET_${name}=... to the server's .env and restart the server.`,
      );
    }
    return resolved;
  });
}
