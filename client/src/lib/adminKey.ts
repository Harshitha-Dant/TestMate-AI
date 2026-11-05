/**
 * The admin key for a public deployment, typed in by the admin in Settings → Admin access.
 * It lives in sessionStorage only (gone when the tab closes) and is sent as a request header;
 * it is never part of the built app. Storage can be unavailable, so every access is guarded.
 */
const KEY = "testmate.adminKey";

export function readAdminKey(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function saveAdminKey(value: string): void {
  try {
    sessionStorage.setItem(KEY, value);
  } catch {
    // Storage blocked: the key just isn't remembered.
  }
}

export function clearAdminKey(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing stored.
  }
}

/** Request headers that carry the admin key, when one is set. */
export function adminHeaders(key: string | null = readAdminKey()): Record<string, string> {
  return key ? { "X-TestMate-Admin-Key": key } : {};
}
