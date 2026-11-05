/** Every API response uses this envelope. */
export type ApiSuccess<T> = { ok: true; data: T };
export type ApiFailure = { ok: false; error: ApiError };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface ApiError {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "BAD_REQUEST"
  | "PAYLOAD_TOO_LARGE"
  | "ADMIN_REQUIRED"
  | "RATE_LIMITED"
  | "LIMIT_REACHED"
  | "INTERNAL_ERROR";

/** What the server tells the UI about how it is running (GET /api/meta). */
export interface AppMeta {
  /** True when the server runs as a shared public demo (TESTMATE_PUBLIC_MODE=1). */
  publicMode: boolean;
  /** Public-mode limits; null when public mode is off. */
  limits: PublicLimits | null;
}

export interface PublicLimits {
  runsPerMinute: number;
  writesPerMinute: number;
  outboundPerHour: number;
  maxProjects: number;
  maxTimeoutMs: number;
  maxResponseKb: number;
}
