import type { Project, ProjectWithStats } from "@testmate/shared";
import type { Db } from "../connection";

interface ProjectRow {
  id: number;
  name: string;
  description: string;
  is_demo: number;
  created_at: string;
  updated_at: string;
}

interface ProjectStatsRow extends ProjectRow {
  suites: number;
  test_cases: number;
  executions: number;
  open_bugs: number;
}

const toProject = (r: ProjectRow): Project => ({
  id: r.id,
  name: r.name,
  description: r.description,
  isDemo: r.is_demo === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const STATS_SELECT = `
  SELECT p.*,
    (SELECT COUNT(*) FROM test_suites s WHERE s.project_id = p.id) AS suites,
    (SELECT COUNT(*) FROM test_cases c WHERE c.project_id = p.id)
      + (SELECT COUNT(*) FROM conversation_sessions cs WHERE cs.project_id = p.id)
      + (SELECT COUNT(*) FROM api_requests a WHERE a.project_id = p.id AND a.kind = 'saved') AS test_cases,
    (SELECT COUNT(*) FROM test_executions e WHERE e.project_id = p.id) AS executions,
    (SELECT COUNT(*) FROM bug_reports b WHERE b.project_id = p.id AND b.status IN ('open', 'in_progress')) AS open_bugs
  FROM projects p`;

const toProjectWithStats = (r: ProjectStatsRow): ProjectWithStats => ({
  ...toProject(r),
  stats: { suites: r.suites, testCases: r.test_cases, executions: r.executions, openBugs: r.open_bugs },
});

export const projectRepo = {
  list(db: Db): ProjectWithStats[] {
    const rows = db.prepare(`${STATS_SELECT} ORDER BY p.created_at ASC, p.id ASC`).all() as ProjectStatsRow[];
    return rows.map(toProjectWithStats);
  },

  get(db: Db, id: number): ProjectWithStats | undefined {
    const row = db.prepare(`${STATS_SELECT} WHERE p.id = ?`).get(id) as ProjectStatsRow | undefined;
    return row && toProjectWithStats(row);
  },

  create(db: Db, input: { name: string; description: string }): number {
    return Number(
      db.prepare("INSERT INTO projects (name, description) VALUES (?, ?)").run(input.name, input.description)
        .lastInsertRowid,
    );
  },

  update(db: Db, id: number, input: { name?: string; description?: string }): boolean {
    const result = db
      .prepare(
        `UPDATE projects SET
           name = COALESCE(?, name),
           description = COALESCE(?, description),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
         WHERE id = ?`,
      )
      .run(input.name ?? null, input.description ?? null, id);
    return result.changes > 0;
  },

  remove(db: Db, id: number): boolean {
    return db.prepare("DELETE FROM projects WHERE id = ?").run(id).changes > 0;
  },
};
