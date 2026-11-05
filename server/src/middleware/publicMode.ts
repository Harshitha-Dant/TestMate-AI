import type { Request, RequestHandler, Response } from "express";
import type { Db } from "../db/connection";
import { HttpError } from "../lib/errors";
import { ADMIN_FAILURES_PER_MINUTE, adminKeyMatches, type PublicPolicy } from "../lib/publicMode";
import { RateLimiter } from "../lib/rateLimit";
import { providerService } from "../services/providerService";

export const ADMIN_KEY_HEADER = "x-testmate-admin-key";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const READ_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Endpoints that run tests or send HTTP requests: rate limited more tightly than other changes. */
const RUN_PATH = /\/(run|send)$|^\/projects\/\d+\/regression\/runs$/;
/** Endpoints that always make requests to other servers (API Studio). */
const API_STUDIO_PATH = /^\/projects\/\d+\/api-studio\/(send|saved\/\d+\/run)$/;
/** Suite and regression runs may include API Studio requests or a live chatbot. */
const SUITE_PATH = /^\/projects\/\d+\/(suites\/\d+\/run|regression\/runs)$/;
/** Single test runs reach another server only when the project targets a live chatbot. */
const SINGLE_RUN_PATH = /^\/projects\/(\d+)\/(test-cases|conversations)\/\d+\/run$/;

/** Paths that change app-wide behaviour and therefore need the admin key. */
const ADMIN_PUT_PATH = /^\/settings\//;

function clientKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

function tooMany(res: Response, retryAfterSec: number, message: string): HttpError {
  res.setHeader("Retry-After", String(retryAfterSec));
  return new HttpError(429, "RATE_LIMITED", message);
}

function needsAdmin(req: Request): boolean {
  if (req.method === "DELETE") return true;
  if (req.method === "PUT" && ADMIN_PUT_PATH.test(req.path)) return true;
  return req.method === "GET" && req.path === "/admin/check";
}

function isOutbound(db: Db, req: Request): boolean {
  if (API_STUDIO_PATH.test(req.path) || SUITE_PATH.test(req.path)) return true;
  const single = SINGLE_RUN_PATH.exec(req.path);
  if (!single) return false;
  try {
    return providerService.getTarget(db, Number(single[1])).kind === "http";
  } catch {
    return false;
  }
}

/** Security headers for the public deployment (served over HTTPS). */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=15552000");
  next();
};

/**
 * Guards every /api request in public mode: per-visitor rate limits, a global cap on requests to other
 * servers, the admin key for destructive or app-wide changes, and a cap on the number of projects.
 */
export function publicModeGuard(db: Db, policy: PublicPolicy): RequestHandler {
  const { limits } = policy;
  const writes = new RateLimiter(limits.writesPerMinute, MINUTE);
  const runs = new RateLimiter(limits.runsPerMinute, MINUTE);
  const outbound = new RateLimiter(limits.outboundPerHour, HOUR);
  const adminFailures = new RateLimiter(ADMIN_FAILURES_PER_MINUTE, MINUTE);

  return (req, res, next) => {
    const who = clientKey(req);
    const mutating = !READ_METHODS.has(req.method);

    if (mutating) {
      const w = writes.hit(who);
      if (!w.allowed) return next(tooMany(res, w.retryAfterSec, "Too many changes from this connection. Wait a moment and try again."));
      if (req.method === "POST" && RUN_PATH.test(req.path)) {
        const r = runs.hit(who);
        if (!r.allowed) return next(tooMany(res, r.retryAfterSec, `This public demo allows ${limits.runsPerMinute} runs per minute. Wait a moment and try again.`));
        if (isOutbound(db, req)) {
          const o = outbound.hit("all");
          if (!o.allowed) return next(tooMany(res, o.retryAfterSec, "This public demo has reached its hourly limit for requests to other servers. Try again later."));
        }
      }
    }

    if (needsAdmin(req)) {
      const presented = req.get(ADMIN_KEY_HEADER);
      if (!adminKeyMatches(policy, presented)) {
        if (presented) {
          const f = adminFailures.hit(who);
          if (!f.allowed) return next(tooMany(res, f.retryAfterSec, "Too many wrong admin keys. Wait a minute and try again."));
        }
        return next(
          new HttpError(
            403,
            "ADMIN_REQUIRED",
            presented
              ? "The admin key is not correct."
              : "This public demo needs the admin key for this action. Enter it in Settings → Admin access.",
          ),
        );
      }
    }

    if (req.method === "POST" && req.path === "/projects") {
      const { count } = db.prepare("SELECT COUNT(*) AS count FROM projects").get() as { count: number };
      if (count >= limits.maxProjects) {
        return next(new HttpError(403, "LIMIT_REACHED", `This public demo holds at most ${limits.maxProjects} projects. Ask the admin to remove one.`));
      }
    }

    next();
  };
}
