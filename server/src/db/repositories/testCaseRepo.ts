import { DEFAULT_CRITERIA, type ExecutionStatus, type TestCase, type TestCriteria } from "@testmate/shared";
import type { Db } from "../connection";
import { parseJson } from "../json";

type CaseModule = TestCase["module"];

interface CaseRow {
  id: number;
  project_id: number;
  suite_id: number | null;
  module: CaseModule;
  title: string;
  input: string;
  expected: string;
  criteria: string;
  input_language: string | null;
  expected_language: string | null;
  expected_intent: string | null;
  is_demo: number;
  created_at: string;
  updated_at: string;
  last_exec_id: number | null;
  last_status: ExecutionStatus | null;
  last_run_at: string | null;
}

/** Each case joined with its most recent execution (override status wins over evaluator status). */
const SELECT = `
  SELECT c.*, e.id AS last_exec_id, COALESCE(e.override_status, e.status) AS last_status, e.created_at AS last_run_at
  FROM test_cases c
  LEFT JOIN test_executions e
    ON e.id = (SELECT MAX(x.id) FROM test_executions x WHERE x.test_case_id = c.id)`;

const toCase = (r: CaseRow): TestCase => ({
  id: r.id,
  projectId: r.project_id,
  suiteId: r.suite_id,
  module: r.module,
  title: r.title,
  input: r.input,
  expected: r.expected,
  criteria: { ...DEFAULT_CRITERIA, ...parseJson<Partial<TestCriteria>>(r.criteria, {}) },
  inputLanguage: r.input_language,
  expectedLanguage: r.expected_language,
  expectedIntent: r.expected_intent,
  isDemo: r.is_demo === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  lastRun:
    r.last_exec_id && r.last_status && r.last_run_at
      ? { executionId: r.last_exec_id, status: r.last_status, at: r.last_run_at }
      : null,
});

export interface CaseWrite {
  suiteId: number | null;
  title: string;
  input: string;
  expected: string;
  criteria: TestCriteria;
  inputLanguage?: string | null;
  expectedLanguage?: string | null;
  expectedIntent?: string | null;
  isDemo?: boolean;
}

export const testCaseRepo = {
  list(db: Db, projectId: number, filter: { module: CaseModule; suiteId?: number | "none" }): TestCase[] {
    const where = ["c.project_id = ?", "c.module = ?"];
    const params: (string | number)[] = [projectId, filter.module];
    if (filter.suiteId === "none") where.push("c.suite_id IS NULL");
    else if (filter.suiteId !== undefined) {
      where.push("c.suite_id = ?");
      params.push(filter.suiteId);
    }
    const rows = db.prepare(`${SELECT} WHERE ${where.join(" AND ")} ORDER BY c.id`).all(...params) as CaseRow[];
    return rows.map(toCase);
  },

  get(db: Db, projectId: number, id: number): TestCase | undefined {
    const row = db.prepare(`${SELECT} WHERE c.project_id = ? AND c.id = ?`).get(projectId, id) as CaseRow | undefined;
    return row && toCase(row);
  },

  create(db: Db, projectId: number, module: CaseModule, input: CaseWrite): number {
    return Number(
      db
        .prepare(
          `INSERT INTO test_cases (project_id, suite_id, module, title, input, expected, criteria,
             input_language, expected_language, expected_intent, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          input.suiteId,
          module,
          input.title,
          input.input,
          input.expected,
          JSON.stringify(input.criteria),
          input.inputLanguage ?? null,
          input.expectedLanguage ?? null,
          input.expectedIntent ?? null,
          input.isDemo ? 1 : 0,
        ).lastInsertRowid,
    );
  },

  update(db: Db, projectId: number, id: number, input: CaseWrite): void {
    db.prepare(
      `UPDATE test_cases SET suite_id = ?, title = ?, input = ?, expected = ?, criteria = ?,
         input_language = ?, expected_language = ?, expected_intent = ?,
         updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE project_id = ? AND id = ?`,
    ).run(
      input.suiteId,
      input.title,
      input.input,
      input.expected,
      JSON.stringify(input.criteria),
      input.inputLanguage ?? null,
      input.expectedLanguage ?? null,
      input.expectedIntent ?? null,
      projectId,
      id,
    );
  },

  /** Past executions are kept for history (test_case_id is set to NULL). */
  remove(db: Db, projectId: number, id: number): boolean {
    return db.prepare("DELETE FROM test_cases WHERE project_id = ? AND id = ?").run(projectId, id).changes > 0;
  },
};
