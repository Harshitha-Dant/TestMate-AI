import { createHash, timingSafeEqual } from "node:crypto";
import type { ApiStudioSettings, PublicLimits } from "@testmate/shared";
import type { Db } from "../db/connection";

/**
 * Public mode turns TestMate AI into a shared online demo. It is off unless TESTMATE_PUBLIC_MODE=1,
 * so local use is unchanged. When on: destructive actions need the admin key, the request-safety
 * settings are locked to safe values, and visitors are rate limited.
 */
export interface PublicModeOptions {
  adminKey: string;
  limits?: Partial<PublicLimits>;
}

export interface PublicPolicy {
  adminKeyDigest: Buffer;
  limits: PublicLimits;
}

export const DEFAULT_PUBLIC_LIMITS: PublicLimits = {
  runsPerMinute: 20,
  writesPerMinute: 60,
  outboundPerHour: 300,
  maxProjects: 25,
  maxTimeoutMs: 8_000,
  maxResponseKb: 256,
};

/** Minimum admin key length; shorter keys are refused at startup. */
export const MIN_ADMIN_KEY_LENGTH = 24;

/** Wrong admin-key attempts allowed per visitor per minute (slows guessing). */
export const ADMIN_FAILURES_PER_MINUTE = 5;

/** Why an admin key is unusable, or null when it is fine. */
export function adminKeyProblem(key: string | undefined): string | null {
  if (!key) return "TESTMATE_ADMIN_KEY is not set.";
  if (key.length < MIN_ADMIN_KEY_LENGTH) return `TESTMATE_ADMIN_KEY must be at least ${MIN_ADMIN_KEY_LENGTH} characters.`;
  if (/\s/.test(key)) return "TESTMATE_ADMIN_KEY must not contain spaces or line breaks.";
  return null;
}

const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();

export function createPublicPolicy(options: PublicModeOptions): PublicPolicy {
  const problem = adminKeyProblem(options.adminKey);
  if (problem) throw new Error(problem);
  return { adminKeyDigest: digest(options.adminKey), limits: { ...DEFAULT_PUBLIC_LIMITS, ...options.limits } };
}

/** Constant-time comparison of a presented key with the configured one (only digests are kept in memory). */
export function adminKeyMatches(policy: PublicPolicy, presented: string | undefined): boolean {
  if (!presented) return false;
  return timingSafeEqual(digest(presented), policy.adminKeyDigest);
}

// The policy is attached to the database handle so services can read it without global state
// (each test app has its own in-memory database).
const policies = new WeakMap<Db, PublicPolicy>();

export function setPublicPolicy(db: Db, policy: PublicPolicy): void {
  policies.set(db, policy);
}

export function publicPolicy(db: Db): PublicPolicy | undefined {
  return policies.get(db);
}

/** In public mode, request-safety settings are forced to safe values whatever is stored. */
export function clampApiStudioSettings(settings: ApiStudioSettings, policy: PublicPolicy | undefined): ApiStudioSettings {
  if (!policy) return settings;
  return {
    ...settings,
    allowLocalhost: false,
    timeoutMs: Math.min(settings.timeoutMs, policy.limits.maxTimeoutMs),
    maxResponseKb: Math.min(settings.maxResponseKb, policy.limits.maxResponseKb),
  };
}
