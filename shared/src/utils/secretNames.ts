// Short words (auth, session, pin...) only count as whole name parts, so "author" or "spinner" are not secret.
const SECRET_NAME =
  /(authorization|cookie|token|secret|passw(or)?d|api[-_]?key|access[-_]?key|private[-_]?key|client[-_]?secret|credential|signature|session[-_]?id|(^|[-_.])(auth|session|sid|pwd|pin|otp|key)([-_.]|$))/i;

/** True for header, query or JSON key names whose values should be treated as secrets (masked, hidden). */
export function isSecretName(name: string): boolean {
  return SECRET_NAME.test(name);
}

/** Matches {{secret:NAME}} placeholders, which are resolved server-side from TESTMATE_SECRET_NAME. */
export const SECRET_PLACEHOLDER = /\{\{\s*secret:([A-Za-z0-9_]+)\s*\}\}/g;
