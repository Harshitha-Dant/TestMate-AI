import type { Db } from "../connection";
import { parseJson } from "../json";

/** Global key/value settings (app_settings). Never store secrets here. */
export const settingsRepo = {
  get<T>(db: Db, key: string): T | undefined {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
    return row ? parseJson<T | undefined>(row.value, undefined) : undefined;
  },

  set(db: Db, key: string, value: unknown): void {
    db.prepare(
      `INSERT INTO app_settings (key, value) VALUES (?, ?)
       ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).run(key, JSON.stringify(value));
  },
};
