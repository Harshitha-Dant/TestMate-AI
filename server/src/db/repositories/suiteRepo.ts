import type { TestModule, TestSuite } from "@testmate/shared";
import type { Db } from "../connection";

interface SuiteRow {
  id: number;
  project_id: number;
  module: TestModule;
  name: string;
  description: string;
  is_demo: number;
  item_count: number;
  created_at: string;
  updated_at: string;
}

const SELECT = `
  SELECT s.*,
    (SELECT COUNT(*) FROM test_cases c WHERE c.suite_id = s.id)
      + (SELECT COUNT(*) FROM conversation_sessions cs WHERE cs.suite_id = s.id)
      + (SELECT COUNT(*) FROM api_requests a WHERE a.suite_id = s.id AND a.kind = 'saved') AS item_count
  FROM test_suites s`;

const toSuite = (r: SuiteRow): TestSuite => ({
  id: r.id,
  projectId: r.project_id,
  module: r.module,
  name: r.name,
  description: r.description,
  isDemo: r.is_demo === 1,
  itemCount: r.item_count,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const suiteRepo = {
  list(db: Db, projectId: number, module?: TestModule): TestSuite[] {
    const rows = module
      ? db.prepare(`${SELECT} WHERE s.project_id = ? AND s.module = ? ORDER BY s.name COLLATE NOCASE`).all(projectId, module)
      : db.prepare(`${SELECT} WHERE s.project_id = ? ORDER BY s.module, s.name COLLATE NOCASE`).all(projectId);
    return (rows as SuiteRow[]).map(toSuite);
  },

  get(db: Db, projectId: number, id: number): TestSuite | undefined {
    const row = db.prepare(`${SELECT} WHERE s.project_id = ? AND s.id = ?`).get(projectId, id) as SuiteRow | undefined;
    return row && toSuite(row);
  },

  findByName(db: Db, projectId: number, module: TestModule, name: string): { id: number } | undefined {
    return db
      .prepare("SELECT id FROM test_suites WHERE project_id = ? AND module = ? AND name = ? COLLATE NOCASE")
      .get(projectId, module, name) as { id: number } | undefined;
  },

  create(db: Db, projectId: number, module: TestModule, input: { name: string; description: string }): number {
    return Number(
      db
        .prepare("INSERT INTO test_suites (project_id, module, name, description) VALUES (?, ?, ?, ?)")
        .run(projectId, module, input.name, input.description).lastInsertRowid,
    );
  },

  update(db: Db, projectId: number, id: number, input: { name?: string; description?: string }): void {
    db.prepare(
      `UPDATE test_suites SET name = COALESCE(?, name), description = COALESCE(?, description),
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE project_id = ? AND id = ?`,
    ).run(input.name ?? null, input.description ?? null, projectId, id);
  },

  /** Cases in the suite are kept and become unassigned (ON DELETE SET NULL). */
  remove(db: Db, projectId: number, id: number): boolean {
    return db.prepare("DELETE FROM test_suites WHERE project_id = ? AND id = ?").run(projectId, id).changes > 0;
  },
};
