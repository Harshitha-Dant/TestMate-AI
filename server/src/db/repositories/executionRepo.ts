import type {
  EvaluatorName,
  Execution,
  ExecutionDetails,
  ExecutionOverride,
  ExecutionStatus,
  ResultSource,
  TestModule,
} from "@testmate/shared";
import type { Db } from "../connection";
import { parseJson } from "../json";

interface ExecutionRow {
  id: number;
  project_id: number;
  module: TestModule;
  test_case_id: number | null;
  session_id: number | null;
  api_request_id: number | null;
  regression_run_id: number | null;
  title: string;
  status: ExecutionStatus;
  score: number | null;
  source: ResultSource;
  evaluator: EvaluatorName;
  input: string;
  output: string;
  explanation: string;
  details: string;
  language: string | null;
  duration_ms: number | null;
  override_status: ExecutionOverride["status"] | null;
  override_note: string | null;
  overridden_at: string | null;
  is_demo: number;
  created_at: string;
}

const toExecution = (r: ExecutionRow): Execution => ({
  id: r.id,
  projectId: r.project_id,
  module: r.module,
  testCaseId: r.test_case_id,
  sessionId: r.session_id,
  apiRequestId: r.api_request_id,
  regressionRunId: r.regression_run_id,
  title: r.title,
  status: r.status,
  effectiveStatus: r.override_status ?? r.status,
  score: r.score,
  source: r.source,
  evaluator: r.evaluator,
  input: r.input,
  output: r.output,
  explanation: r.explanation,
  details: parseJson<ExecutionDetails>(r.details, {}),
  language: r.language,
  durationMs: r.duration_ms,
  override:
    r.override_status && r.overridden_at
      ? { status: r.override_status, note: r.override_note ?? "", at: r.overridden_at }
      : null,
  isDemo: r.is_demo === 1,
  createdAt: r.created_at,
});

export interface ExecutionWrite {
  module: TestModule;
  testCaseId?: number | null;
  sessionId?: number | null;
  apiRequestId?: number | null;
  regressionRunId?: number | null;
  title: string;
  status: ExecutionStatus;
  score: number | null;
  source: ResultSource;
  evaluator: EvaluatorName;
  input: string;
  output: string;
  explanation: string;
  details: ExecutionDetails;
  language?: string | null;
  durationMs: number | null;
  isDemo?: boolean;
}

export interface ExecutionFilter {
  module?: TestModule;
  testCaseId?: number;
  sessionId?: number;
  /** Effective status (override wins). */
  status?: ExecutionStatus;
  source?: ResultSource;
  /** Matches title, input or output. */
  q?: string;
  /** Only executions from the last N days. */
  days?: number;
  limit: number;
  offset: number;
}

export const executionRepo = {
  insert(db: Db, projectId: number, e: ExecutionWrite): number {
    return Number(
      db
        .prepare(
          `INSERT INTO test_executions (project_id, module, test_case_id, session_id, api_request_id, regression_run_id,
             title, status, score, source, evaluator, input, output, explanation, details, language, duration_ms, is_demo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          projectId,
          e.module,
          e.testCaseId ?? null,
          e.sessionId ?? null,
          e.apiRequestId ?? null,
          e.regressionRunId ?? null,
          e.title,
          e.status,
          e.score,
          e.source,
          e.evaluator,
          e.input,
          e.output,
          e.explanation,
          JSON.stringify(e.details),
          e.language ?? null,
          e.durationMs,
          e.isDemo ? 1 : 0,
        ).lastInsertRowid,
    );
  },

  get(db: Db, projectId: number, id: number): Execution | undefined {
    const row = db.prepare("SELECT * FROM test_executions WHERE project_id = ? AND id = ?").get(projectId, id) as
      | ExecutionRow
      | undefined;
    return row && toExecution(row);
  },

  list(db: Db, projectId: number, f: ExecutionFilter): { items: Execution[]; total: number } {
    const where = ["project_id = ?"];
    const params: (string | number)[] = [projectId];
    if (f.module) {
      where.push("module = ?");
      params.push(f.module);
    }
    if (f.testCaseId) {
      where.push("test_case_id = ?");
      params.push(f.testCaseId);
    }
    if (f.sessionId) {
      where.push("session_id = ?");
      params.push(f.sessionId);
    }
    if (f.status) {
      where.push("COALESCE(override_status, status) = ?");
      params.push(f.status);
    }
    if (f.source) {
      where.push("source = ?");
      params.push(f.source);
    }
    if (f.q) {
      const like = `%${f.q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      where.push("(title LIKE ? ESCAPE '\\' OR input LIKE ? ESCAPE '\\' OR output LIKE ? ESCAPE '\\')");
      params.push(like, like, like);
    }
    if (f.days) {
      where.push("created_at >= ?");
      params.push(new Date(Date.now() - f.days * 86_400_000).toISOString());
    }
    const clause = where.join(" AND ");
    const total = (db.prepare(`SELECT COUNT(*) AS n FROM test_executions WHERE ${clause}`).get(...params) as { n: number }).n;
    const rows = db
      .prepare(`SELECT * FROM test_executions WHERE ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`)
      .all(...params, f.limit, f.offset) as ExecutionRow[];
    return { items: rows.map(toExecution), total };
  },

  setOverride(db: Db, projectId: number, id: number, status: ExecutionOverride["status"] | null, note: string | null): void {
    db.prepare(
      `UPDATE test_executions SET override_status = ?, override_note = ?,
         overridden_at = CASE WHEN ? IS NULL THEN NULL ELSE strftime('%Y-%m-%dT%H:%M:%fZ', 'now') END
       WHERE project_id = ? AND id = ?`,
    ).run(status, note, status, projectId, id);
  },
};
