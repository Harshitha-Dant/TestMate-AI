import path from "node:path";
import express from "express";
import type { Db } from "./db/connection";
import { createPublicPolicy, setPublicPolicy, type PublicModeOptions } from "./lib/publicMode";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { publicModeGuard, securityHeaders } from "./middleware/publicMode";
import { createApiRouter } from "./routes";

export interface AppOptions {
  /** A built client (`npm run build`) to serve with a single-page-app fallback. */
  clientDir?: string;
  /** Public demo mode (admin key, rate limits, locked request settings). Off when omitted. */
  publicMode?: PublicModeOptions;
  /** Proxy hops to trust for the visitor's IP address (rate limits). Only used in public mode. */
  trustProxyHops?: number;
}

/**
 * Builds the Express app around an open, migrated database. Used by index.ts and the tests.
 * Without `publicMode` the app behaves exactly as it does for local use.
 */
export function createApp(db: Db, options: AppOptions = {}) {
  const app = express();
  app.locals.db = db;
  app.disable("x-powered-by");
  if (options.publicMode) {
    const policy = createPublicPolicy(options.publicMode);
    setPublicPolicy(db, policy);
    app.set("trust proxy", options.trustProxyHops ?? 1);
    app.use(securityHeaders);
    // Before body parsing, so rate-limited requests are rejected cheaply.
    app.use("/api", publicModeGuard(db, policy));
  }
  app.use(express.json({ limit: "1mb" }));

  app.use("/api", createApiRouter());
  app.use("/api", notFoundHandler);
  if (options.clientDir) {
    const clientDir = options.clientDir;
    app.use(express.static(clientDir, { index: false, maxAge: "1h" }));
    app.use((req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      res.sendFile(path.join(clientDir, "index.html"));
    });
  }
  app.use(errorHandler);

  return app;
}
