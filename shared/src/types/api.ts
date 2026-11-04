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
  | "INTERNAL_ERROR";
