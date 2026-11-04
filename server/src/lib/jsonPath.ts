/**
 * Minimal JSON path for response assertions: dot keys and bracket indexes/keys.
 * Examples: "id", "data.items[0].name", "$.meta['x-total']", "[2]". "$" or "" is the root.
 */

type Segment = string | number;

export function parsePath(path: string): Segment[] | null {
  const segments: Segment[] = [];
  let i = path.trim().startsWith("$") ? path.trim().indexOf("$") + 1 : 0;
  const s = path.trim();
  while (i < s.length) {
    const ch = s[i];
    if (ch === ".") {
      i++;
      continue;
    }
    if (ch === "[") {
      const close = s.indexOf("]", i);
      if (close === -1) return null;
      const inner = s.slice(i + 1, close).trim();
      const quoted = /^(['"])(.*)\1$/.exec(inner);
      if (quoted) segments.push(quoted[2]!);
      else if (/^\d+$/.test(inner)) segments.push(Number(inner));
      else return null;
      i = close + 1;
      continue;
    }
    const match = /^[^.[\]]+/.exec(s.slice(i));
    if (!match) return null;
    segments.push(match[0]);
    i += match[0].length;
  }
  return segments;
}

export function getPath(root: unknown, segments: Segment[]): { found: boolean; value: unknown } {
  let current: unknown = root;
  for (const seg of segments) {
    if (typeof seg === "number") {
      if (!Array.isArray(current) || seg >= current.length) return { found: false, value: undefined };
      current = current[seg];
    } else {
      if (current === null || typeof current !== "object" || Array.isArray(current) || !(seg in current)) {
        return { found: false, value: undefined };
      }
      current = (current as Record<string, unknown>)[seg];
    }
  }
  return { found: true, value: current };
}

export function jsonType(value: unknown): "string" | "number" | "boolean" | "object" | "array" | "null" {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value as "string" | "number" | "boolean" | "object";
}

/**
 * Compares an actual JSON value with the expected text from the form. The text is parsed as JSON when
 * possible ("42", "true", "null", {"a":1}); otherwise it is compared as a plain string.
 */
export function valueEquals(actual: unknown, expectedText: string): boolean {
  let expected: unknown = expectedText;
  try {
    expected = JSON.parse(expectedText);
  } catch {
    // Plain text: compare with strings only.
  }
  if (typeof actual === "string" && typeof expected !== "string") return actual === expectedText;
  return deepEqual(actual, expected);
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
