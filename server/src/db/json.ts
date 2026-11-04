/** Parses a JSON TEXT column, returning `fallback` for null or corrupt values instead of throwing. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
