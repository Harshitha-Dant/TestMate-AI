import type { ExecutionStatus, RegressionChange, RegressionResultRow, RegressionRunSummary, TestModule } from "@testmate/shared";
import type { Db } from "../connection";

interface RunRow {
  id: number;
  project_id: number;
  suite_id: number | null;
  suite_name: string | null;
  module: TestModule | null;
  baseline_run_id: number | null;
  label: string;
  total: number;
  passed: number;
  failed: number;
  needs_review: number;
  errors: number;
  pass_rate: number;
  baseline_pass_rate: number | null;
  new_failures: number;
  fixed: number;
  is_demo: number;
  created_at: string;
}

interface ResultRow {
  item_key: string;
  test_title: string;
  status: ExecutionStatus;
  previous_status: ExecutionStatus | null;
  change: RegressionChange;
  execution_id: number | null;
  previous_execution_id: number | null;
}

const SELECT_RUN = `
  SELECT r.*, s.name AS suite_name, s.module AS module, b.pass_rate AS baseline_pass_rate,
    (SELECT COUNT(*) FROM regression_results x WHERE x.run_id = r.id AND x.change = 'new_failure') AS new_failures,
    (SELECT COUNT(*) FROM regression_results x WHERE x.run_id = r.id AND x.change = 'fixed') AS fixed
  FROM regression_runs r
  LEFT JOIN test_suites s ON s.id = r.suite_id
  LEFT JOIN regression_runs b ON b.id = r.baseline_run_id`;

const toSummary = (r: RunRow): RegressionRunSummary => ({
  id: r.id,
  projectId: r.project_id,
  suiteId: r.suite_id,
  suiteName: r.suite_name ?? "Deleted suite",
  module: r.module,
  baselineRunId: r.baseline_run_id,
  label: r.label,
  total: r.total,
  passed: r.passed,
  failed: r.failed,
  needsReview: r.needs_review,
  errors: r.errors,
  passRate: r.pass_rate,
  baselinePassRate: r.baseline_pass_rate,
  passRateDelta: r.baseline_pass_rate === null ? null : Math.round((r.pass_rate - r.baseline_pass_rate) * 10) / 10,
  newFailures: r.new_failures,
  fixed: r.fixed,
  isDemo: r.is_demo === 1,
  createdAt: r.created_at,
});

export const regressionRepo = {
  createRun(db: Db, projectId: number, input: { suiteId: number; baselineRunId: number | null; label: string; isDemo?: boolean }): number {
    return Number(
      db
        .prepare("INSERT INTO regression_runs (project_id, suite_id, baseline_run_id, label, is_demo) VALUES (?, ?, ?, ?, ?)")
        .run(projectId, input.suiteId, input.baselineRunId, input.label, input.isDemo ? 1 : 0).lastInsertRowid,
    );
  },

  finishRun(
    db: Db,
    runId: number,
    counts: { total: number; passed: number; failed: number; needsReview: number; errors: number; passRate: number },
    results: RegressionResultRow[],
  ): void {
    db.transaction(() => {
      db.prepare(
        "UPDATE regression_runs SET total = ?, passed = ?, failed = ?, needs_review = ?, errors = ?, pass_rate = ? WHERE id = ?",
      ).run(counts.total, counts.passed, counts.failed, counts.needsReview, counts.errors, counts.passRate, runId);
      const insert = db.prepare(
        `INSERT INTO regression_results (run_id, item_key, test_title, execution_id, previous_execution_id, status, previous_status, change)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const r of results) {
        insert.run(runId, r.itemKey, r.title, r.executionId, r.previousExecutionId, r.status, r.previousStatus, r.change);
      }
    })();
  },

  list(db: Db, projectId: number, suiteId?: number): RegressionRunSummary[] {
    const rows = suiteId
      ? db.prepare(`${SELECT_RUN} WHERE r.project_id = ? AND r.suite_id = ? ORDER BY r.id DESC`).all(projectId, suiteId)
      : db.prepare(`${SELECT_RUN} WHERE r.project_id = ? ORDER BY r.id DESC LIMIT 200`).all(projectId);
    return (rows as RunRow[]).map(toSummary);
  },

  get(db: Db, projectId: number, id: number): RegressionRunSummary | undefined {
    const row = db.prepare(`${SELECT_RUN} WHERE r.project_id = ? AND r.id = ?`).get(projectId, id) as RunRow | undefined;
    return row && toSummary(row);
  },

  latestForSuite(db: Db, projectId: number, suiteId: number): { id: number } | undefined {
    return db
      .prepare("SELECT id FROM regression_runs WHERE project_id = ? AND suite_id = ? ORDER BY id DESC LIMIT 1")
      .get(projectId, suiteId) as { id: number } | undefined;
  },

  results(db: Db, runId: number): RegressionResultRow[] {
    const rows = db.prepare("SELECT * FROM regression_results WHERE run_id = ? ORDER BY id").all(runId) as ResultRow[];
    return rows.map((r) => ({
      itemKey: r.item_key,
      title: r.test_title,
      status: r.status,
      previousStatus: r.previous_status,
      change: r.change,
      executionId: r.execution_id,
      previousExecutionId: r.previous_execution_id,
    }));
  },

  remove(db: Db, projectId: number, id: number): boolean {
    return db.prepare("DELETE FROM regression_runs WHERE project_id = ? AND id = ?").run(projectId, id).changes > 0;
  },
};
