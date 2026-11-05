import fs from "node:fs";
import path from "node:path";
import { createApp } from "./app";
import { config } from "./config";
import { adminKeyProblem } from "./lib/publicMode";
import { openDb } from "./db/connection";
import { migrate } from "./db/migrate";

// Public mode must not start without a usable admin key: destructive actions would be open to everyone.
if (config.publicMode) {
  const problem = adminKeyProblem(config.adminKey);
  if (problem) {
    console.error(`[server] Public mode is on but ${problem} Refusing to start.`);
    process.exit(1);
  }
}

const db = openDb(config.dbPath);
const applied = migrate(db);
if (applied.length) console.log(`[db] applied migrations: ${applied.join(", ")}`);

// After `npm run build`, `npm start` also serves the UI on the API port. `npm run dev` passes --api-only,
// so an old build is never served next to Vite (:5173).
const clientDir = path.join(config.serverRoot, "..", "client", "dist");
const serveClient = !process.argv.includes("--api-only") && fs.existsSync(path.join(clientDir, "index.html"));

const app = createApp(db, {
  clientDir: serveClient ? clientDir : undefined,
  publicMode: config.publicMode ? { adminKey: config.adminKey as string } : undefined,
  trustProxyHops: config.trustProxyHops,
});

const server = app.listen(config.port, () => {
  console.log(`[server] TestMate AI API on http://localhost:${config.port}/api (db: ${config.dbPath})`);
  if (serveClient) console.log(`[server] UI on http://localhost:${config.port}`);
  if (config.publicMode) console.log("[server] Public mode is on: admin key required for destructive actions, rate limits active.");
});

function shutdown() {
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
