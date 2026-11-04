import type { Db } from "../connection";
import { parseJson } from "../json";

export const projectSettingsRepo = {
  get<T>(db: Db, projectId: number, key: string): T | undefined {
    const row = db.prepare("SELECT value FROM project_settings WHERE project_id = ? AND key = ?").get(projectId, key) as
      | { value: string }
      | undefined;
    return row ? parseJson<T | undefined>(row.value, undefined) : undefined;
  },

  set(db: Db, projectId: number, key: string, value: unknown): void {
    db.prepare(
      `INSERT INTO project_settings (project_id, key, value) VALUES (?, ?, ?)
       ON CONFLICT (project_id, key) DO UPDATE SET value = excluded.value,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    ).run(projectId, key, JSON.stringify(value));
  },
};
