import path from "node:path";
import express from "express";
import type { Db } from "./db/connection";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";
import { createApiRouter } from "./routes";

/**
 * Builds the Express app around an open, migrated database. Used by index.ts and the tests.
 * With `clientDir` (a built client, `npm run build`), it also serves the UI with a single-page-app fallback.
 */
export function createApp(db: Db, options: { clientDir?: string } = {}) {
  const app = express();
  app.locals.db = db;
  app.disable("x-powered-by");
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
