import { createApp } from "../src/app";
import { openDb } from "../src/db/connection";
import { migrate } from "../src/db/migrate";

/** Fresh in-memory database with all migrations applied, plus an app bound to it. */
export function setup() {
  const db = openDb(":memory:");
  migrate(db);
  return { db, app: createApp(db) };
}
