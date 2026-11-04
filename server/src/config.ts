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
};
