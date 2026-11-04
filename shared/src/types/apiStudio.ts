import type { ExecutionStatus, HttpMethod } from "./domain";

export interface HeaderEntry {
  key: string;
  value: string;
  enabled: boolean;
}

export const BODY_TYPES = ["none", "json", "text"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

/** "any" only checks that the path exists. */
export const ASSERTION_TYPES = ["any", "string", "number", "boolean", "object", "array", "null"] as const;
export type AssertionType = (typeof ASSERTION_TYPES)[number];

export interface FieldAssertion {
  /** Dot/bracket path into the JSON response, e.g. data.items[0].id */
  path: string;
  type: AssertionType;
  /** Optional expected value, written as JSON or plain text ("42", "true", "Ravi", {"a":1}). */
  equals: string | null;
}

export interface ApiExpectations {
  /** Exact status; null means any 2xx. */
  status: number | null;
  maxTimeMs: number | null;
  fields: FieldAssertion[];
}

export interface ApiRequestInput {
  name: string;
  method: HttpMethod;
  url: string;
  headers: HeaderEntry[];
  bodyType: BodyType;
  body: string;
  expectations: ApiExpectations;
  suiteId?: number | null;
}

export const API_ERROR_KINDS = [
  "invalid_url",
  "blocked",
  "dns",
  "refused",
  "timeout",
  "reset",
  "tls",
  "too_many_redirects",
  "invalid_request_body",
  "missing_secret",
  "network",
] as const;
export type ApiErrorKind = (typeof API_ERROR_KINDS)[number];

export interface ApiCallError {
  kind: ApiErrorKind;
  message: string;
}

export interface ApiResponseData {
  status: number;
  statusText: string;
  timeMs: number;
  /** Response headers; secret-like values are masked. */
  headers: [string, string][];
  body: string;
  /** Decoded body size in bytes (up to the cap). */
  bodyBytes: number;
  /** True when the body hit the size cap and was cut off. */
  truncated: boolean;
  contentType: string | null;
  redirects: { status: number; url: string }[];
  /** The IP address actually connected to (after SSRF checks). */
  remoteAddress: string | null;
}

export interface ApiHistoryEntry {
  id: number;
  projectId: number;
  kind: "history" | "saved";
  suiteId: number | null;
  name: string;
  method: HttpMethod;
  /** Secret-like query values are masked. */
  url: string;
  /** Secret-like header values are masked; {{secret:NAME}} placeholders are kept. */
  headers: HeaderEntry[];
  bodyType: BodyType;
  body: string;
  expectations: ApiExpectations;
  response: ApiResponseData | null;
  error: ApiCallError | null;
  /** Latest execution for this request (history entries have exactly one). */
  lastRun: { executionId: number; status: ExecutionStatus; at: string } | null;
  isDemo: boolean;
  createdAt: string;
}

export interface ApiStudioSettings {
  /** Off by default: when on, loopback addresses (127.0.0.0/8, ::1, localhost) may be requested. */
  allowLocalhost: boolean;
  timeoutMs: number;
  maxResponseKb: number;
}

export const DEFAULT_API_STUDIO_SETTINGS: ApiStudioSettings = {
  allowLocalhost: false,
  timeoutMs: 10_000,
  maxResponseKb: 1024,
};

/** Masked secret marker used in stored and displayed values. */
export const SECRET_MASK = "••••••••";

/**
 * Live chatbot under test, reached over HTTP through the SSRF-safe client.
 * Request: POST url with JSON { "message": "<latest user message>", "messages": [{ role, content }, ...] }.
 * Response: JSON; the reply text is read from `replyPath` (e.g. "reply" or "data.choices[0].text"),
 * or the whole body is used as plain text when replyPath is empty.
 */
export interface HttpChatbotConfig {
  url: string;
  replyPath: string;
  /** Secret-like values must be {{secret:NAME}} placeholders (resolved from the server env). */
  headers: HeaderEntry[];
  /** Send the whole conversation in `messages` (needed for memory tests) or only the latest message. */
  sendHistory: boolean;
}

export interface ChatbotTarget {
  kind: "mock" | "http";
  http: HttpChatbotConfig | null;
}

export const DEFAULT_CHATBOT_TARGET: ChatbotTarget = { kind: "mock", http: null };
