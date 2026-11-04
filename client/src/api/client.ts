import type { ApiResponse, ErrorCode } from "@testmate/shared";

export type ClientErrorCode = ErrorCode | "NETWORK_ERROR" | "BAD_RESPONSE";

export class ApiClientError extends Error {
  constructor(
    public readonly code: ClientErrorCode,
    message: string,
    public readonly details?: unknown,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ApiClientError";
  }

  /** Field-level validation messages keyed by path, when the server sent them. */
  fieldErrors(): Record<string, string> {
    if (this.code !== "VALIDATION_ERROR" || !Array.isArray(this.details)) return {};
    const out: Record<string, string> = {};
    for (const d of this.details as { path: string; message: string }[]) out[d.path || "_"] ??= d.message;
    return out;
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

const SERVER_DOWN = "Cannot reach the TestMate server. Make sure it is running (npm run dev).";

export async function apiRequest<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const { method = "GET", body } = options;
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("NETWORK_ERROR", SERVER_DOWN);
  }

  let json: ApiResponse<T>;
  try {
    json = (await res.json()) as ApiResponse<T>;
  } catch {
    // The Vite proxy answers with a non-JSON 5xx when the API server is down.
    if (res.status >= 500) throw new ApiClientError("NETWORK_ERROR", SERVER_DOWN, undefined, res.status);
    throw new ApiClientError("BAD_RESPONSE", `Unreadable server response (HTTP ${res.status})`, undefined, res.status);
  }

  if (!json.ok) throw new ApiClientError(json.error.code, json.error.message, json.error.details, res.status);
  return json.data;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong";
}
