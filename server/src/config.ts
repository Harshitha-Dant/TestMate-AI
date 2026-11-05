import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Optional root .env (see .env.example). Values already in the environment win.
const envFile = path.join(serverRoot, "..", ".env");
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);

export const config = {
  serverRoot,
  // A dedicated variable: a generic PORT is often set by tools for the client dev server.
  port: Number(process.env.TESTMATE_API_PORT ?? 4000),
  dbPath: process.env.TESTMATE_DB_PATH ?? path.join(serverRoot, "data", "testmate.db"),
  /** Public demo mode for an online deployment; off unless TESTMATE_PUBLIC_MODE=1. */
  publicMode: process.env.TESTMATE_PUBLIC_MODE === "1",
  /** Required in public mode. Never logged or sent to the browser. */
  adminKey: process.env.TESTMATE_ADMIN_KEY,
  /** Reverse-proxy hops in front of the app (Render: 1), used to find the visitor's IP for rate limits. */
  trustProxyHops: Number(process.env.TESTMATE_TRUST_PROXY_HOPS ?? 1),
};
