import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import type { ApiFailure } from "@testmate/shared";
import { HttpError } from "../lib/errors";

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new HttpError(404, "NOT_FOUND", `Route ${req.method} ${req.path} not found`));
};

/** Central error handler: maps known errors to the API envelope; never leaks stack traces or request bodies. */
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500;
  let body: ApiFailure = { ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } };

  if (err instanceof HttpError) {
    status = err.status;
    body = { ok: false, error: { code: err.code, message: err.message, details: err.details } };
  } else if (err instanceof ZodError) {
    status = 400;
    body = {
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid input",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    };
  } else if (isBodyParseError(err)) {
    status = 400;
    body = { ok: false, error: { code: "BAD_REQUEST", message: "Request body is not valid JSON" } };
  } else if (bodyErrorType(err) === "entity.too.large") {
    status = 413;
    body = { ok: false, error: { code: "PAYLOAD_TOO_LARGE", message: "Request body is too large (limit 1 MB)" } };
  } else if (isClientBodyError(err)) {
    // Other body-parser rejections (unsupported encoding or charset, aborted upload): the client's fault, not a 500.
    status = err.status;
    body = { ok: false, error: { code: "BAD_REQUEST", message: "The request body couldn't be read" } };
  } else if (isSqliteError(err) && err.code.startsWith("SQLITE_CONSTRAINT_UNIQUE")) {
    status = 409;
    body = { ok: false, error: { code: "CONFLICT", message: "A record with that name already exists" } };
  }

  if (status >= 500) {
    // Log only method, path and error message: never headers or bodies, which may hold secrets.
    console.error(`[error] ${req.method} ${req.path}: ${err instanceof Error ? err.message : String(err)}`);
  }
  res.status(status).json(body);
};

function isBodyParseError(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { type?: string }).type === "entity.parse.failed";
}

function bodyErrorType(err: unknown): string | undefined {
  return typeof err === "object" && err !== null ? (err as { type?: string }).type : undefined;
}

/** body-parser errors carry an HTTP status and `expose: true` when the request itself was bad. */
function isClientBodyError(err: unknown): err is { status: number } {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { status?: unknown; expose?: unknown; type?: unknown };
  return typeof e.type === "string" && e.expose === true && typeof e.status === "number" && e.status >= 400 && e.status < 500;
}

function isSqliteError(err: unknown): err is { code: string } {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { code?: unknown }).code === "string" &&
    (err as { code: string }).code.startsWith("SQLITE_")
  );
}
