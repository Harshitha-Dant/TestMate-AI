import type { Bug, BugCategory, BugHistoryEntry, BugSeverity, BugStatus, TestModule } from "@testmate/shared";
import type { Db } from "../connection";

interface BugRow {
  id: number;
  project_id: number;
  execution_id: number | null;
  regression_run_id: number | null;
  item_key: string | null;
  title: string;
  module: TestModule | null;
  category: BugCategory;
  severity: BugSeverity;
  status: BugStatus;
  failure_explanation: string;
  notes: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

interface HistoryRow {
  id: number;
  action: BugHistoryEntry["action"];
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  note: string | null;
  created_at: string;
}

const toBug = (r: BugRow): Bug => ({
  id: r.id,
  projectId: r.project_id,
  executionId: r.execution_id,
  regressionRunId: r.regression_run_id,
  itemKey: r.item_key,
  title: r.title,
  module: r.module,
  category: r.category,
  severity: r.severity,
  status: r.status,
  failureExplanation: r.failure_explanation,
  notes: r.notes,
  isDemo: r.is_demo === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface BugWrite {
  title: string;
  module: TestModule | null;
  category: BugCategory;
  severity: BugSeverity;
  status?: BugStatus;
  failureExplanation: string;
  notes: string;
  executionId: number | null;
  regressionRunId?: number | null;
  itemKey?: string | null;
  isDemo?: boolean;
}

export interface BugFilter {
  status?: BugStatus;
  severity?: BugSeverity;
  module?: TestModule;
  q?: string;
}

/** Severity order for sorting: critical first. */
const SEVERITY_ORDER = "CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END";

export const bugRepo = {
  insert(db: Db, projectId: number, w: BugWrite): number {
    return Number(
      db
        .prepare(
          `INSERT INTO bug_reports (project_id, execution_id, regression_run_id, item_key, title, module, category, severity, status,
             failure_explanation, notes, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          w.executionId,
          w.regressionRunId ?? null,
          w.itemKey ?? null,
          w.title,
          w.module,
          w.category,
          w.severity,
          w.status ?? "open",
          w.failureExplanation,
          w.notes,
          w.isDemo ? 1 : 0,
        ).lastInsertRowid,
    );
  },

  get(db: Db, projectId: number, id: number): Bug | undefined {
    const row = db.prepare("SELECT * FROM bug_reports WHERE project_id = ? AND id = ?").get(projectId, id) as BugRow | undefined;
    return row && toBug(row);
  },

  list(db: Db, projectId: number, f: BugFilter): Bug[] {
    const where = ["project_id = ?"];
    const params: (string | number)[] = [projectId];
    if (f.status) {
      where.push("status = ?");
      params.push(f.status);
    }
    if (f.severity) {
      where.push("severity = ?");
      params.push(f.severity);
    }
    if (f.module) {
      where.push("module = ?");
      params.push(f.module);
    }
    if (f.q) {
      where.push("(title LIKE ? ESCAPE '\\' OR failure_explanation LIKE ? ESCAPE '\\' OR notes LIKE ? ESCAPE '\\')");
      const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      params.push(like, like, like);
    }
    const rows = db
      .prepare(`SELECT * FROM bug_reports WHERE ${where.join(" AND ")} ORDER BY ${SEVERITY_ORDER}, id DESC`)
      .all(...params) as BugRow[];
    return rows.map(toBug);
  },

  /** An unresolved bug already tracking this test item, if any. */
  findOpenByItem(db: Db, projectId: number, itemKey: string): Bug | undefined {
    const row = db
      .prepare("SELECT * FROM bug_reports WHERE project_id = ? AND item_key = ? AND status IN ('open', 'in_progress') ORDER BY id DESC LIMIT 1")
      .get(projectId, itemKey) as BugRow | undefined;
    return row && toBug(row);
  },

  update(db: Db, projectId: number, id: number, fields: Partial<Pick<Bug, "title" | "category" | "severity" | "status" | "notes">>): void {
    const columns: Record<string, string> = { title: "title", category: "category", severity: "severity", status: "status", notes: "notes" };
    const sets: string[] = [];
    const params: string[] = [];
    for (const [key, column] of Object.entries(columns)) {
      const value = fields[key as keyof typeof fields];
      if (value !== undefined) {
        sets.push(`${column} = ?`);
        params.push(value);
      }
    }
    if (!sets.length) return;
    db.prepare(
      `UPDATE bug_reports SET ${sets.join(", ")}, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE project_id = ? AND id = ?`,
    ).run(...params, projectId, id);
  },

  touch(db: Db, id: number): void {
    db.prepare("UPDATE bug_reports SET updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(id);
  },

  remove(db: Db, projectId: number, id: number): boolean {
    return db.prepare("DELETE FROM bug_reports WHERE project_id = ? AND id = ?").run(projectId, id).changes > 0;
  },

  addHistory(
    db: Db,
    bugId: number,
    h: { action: BugHistoryEntry["action"]; field?: string | null; oldValue?: string | null; newValue?: string | null; note?: string | null },
  ): void {
    db.prepare("INSERT INTO bug_history (bug_id, action, field, old_value, new_value, note) VALUES (?, ?, ?, ?, ?, ?)").run(
      bugId,
      h.action,
      h.field ?? null,
      h.oldValue ?? null,
      h.newValue ?? null,
      h.note ?? null,
    );
  },

  history(db: Db, bugId: number): BugHistoryEntry[] {
    const rows = db.prepare("SELECT * FROM bug_history WHERE bug_id = ? ORDER BY id").all(bugId) as HistoryRow[];
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      field: r.field,
      oldValue: r.old_value,
      newValue: r.new_value,
      note: r.note,
      createdAt: r.created_at,
    }));
  },

  counts(db: Db, projectId: number): { status: BugStatus; severity: BugSeverity; n: number }[] {
    return db
      .prepare("SELECT status, severity, COUNT(*) AS n FROM bug_reports WHERE project_id = ? GROUP BY status, severity")
      .all(projectId) as { status: BugStatus; severity: BugSeverity; n: number }[];
  },
};
