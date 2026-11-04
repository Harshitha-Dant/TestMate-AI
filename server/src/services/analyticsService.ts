import {
  MEMORY_ISSUES,
  QUALITY_WEIGHTS,
  TEST_MODULES,
  type Analytics,
  type ExecutionDetails,
  type ExecutionStatus,
  type MemoryIssueType,
  type ModuleStat,
  type ResultSource,
  type TestModule,
  type TrendPoint,
} from "@testmate/shared";
import type { Db } from "../db/connection";
import { parseJson } from "../db/json";
import { regressionRepo } from "../db/repositories/regressionRepo";
import { bugService } from "./bugService";
import { multilingualService } from "./multilingualService";

interface Row {
  id: number;
  module: TestModule;
  title: string;
  input: string;
  status: ExecutionStatus;
  score: number | null;
  source: ResultSource;
  details: string;
  created_at: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Pass rate with needs-review counted as half a pass. */
function weightedRate(rows: { status: ExecutionStatus }[]): number | null {
  if (!rows.length) return null;
  const points = rows.reduce((s, r) => s + (r.status === "passed" ? 1 : r.status === "needs_review" ? 0.5 : 0), 0);
  return round1((points / rows.length) * 100);
}

function percentile(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

const SELECT = `SELECT id, module, title, input, COALESCE(override_status, status) AS status, score, source, details, created_at
  FROM test_executions`;

/**
 * Everything the dashboard and reports show, computed from stored executions only.
 * "Latest per test" means the most recent execution for each test case, script or API endpoint (method + masked URL).
 */
export const analyticsService = {
  overview(db: Db, projectId: number, opts: { days: number | null; trendDays?: number }): Analytics {
    const from = opts.days ? new Date(Date.now() - opts.days * 86_400_000).toISOString() : null;
    const rangeClause = from ? "AND created_at >= ?" : "";
    const rangeParams = from ? [from] : [];

    const all = db.prepare(`${SELECT} WHERE project_id = ? ${rangeClause} ORDER BY id`).all(projectId, ...rangeParams) as Row[];
    const latest = db
      .prepare(
        `${SELECT} WHERE id IN (
           SELECT MAX(id) FROM test_executions WHERE project_id = ? ${rangeClause}
           GROUP BY module, COALESCE('case:' || test_case_id, 'script:' || session_id, 'in:' || input)
         ) ORDER BY id`,
      )
      .all(projectId, ...rangeParams) as Row[];

    const count = (rows: Row[], s: ExecutionStatus) => rows.filter((r) => r.status === s).length;

    // Per-module stats and the quality score, over the latest result of each test.
    const modules: ModuleStat[] = TEST_MODULES.map((module) => {
      const rows = latest.filter((r) => r.module === module);
      const scored = rows.filter((r) => r.score !== null);
      return {
        module,
        tests: rows.length,
        passed: count(rows, "passed"),
        failed: count(rows, "failed"),
        needsReview: count(rows, "needs_review"),
        errors: count(rows, "error"),
        passRate: weightedRate(rows),
        avgScore: scored.length ? round1(scored.reduce((s, r) => s + r.score!, 0) / scored.length) : null,
      };
    });
    const present = modules.filter((m) => m.passRate !== null);
    const weightSum = present.reduce((s, m) => s + QUALITY_WEIGHTS[m.module], 0);
    const components = present.map((m) => ({ module: m.module, weight: round1((QUALITY_WEIGHTS[m.module] / weightSum) * 100), passRate: m.passRate! }));
    const score = present.length ? round1(present.reduce((s, m) => s + m.passRate! * (QUALITY_WEIGHTS[m.module] / weightSum), 0)) : null;

    // Daily trend (UTC days), zero-filled.
    const trendDays = opts.trendDays ?? (opts.days && opts.days <= 31 ? opts.days : 14);
    const trend: TrendPoint[] = [];
    const byDay = new Map<string, TrendPoint>();
    for (let i = trendDays - 1; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      const point = { date, passed: 0, failed: 0, needsReview: 0, errors: 0 };
      byDay.set(date, point);
      trend.push(point);
    }
    const trendRows = db
      .prepare(`SELECT substr(created_at, 1, 10) AS day, COALESCE(override_status, status) AS status, COUNT(*) AS n
                FROM test_executions WHERE project_id = ? AND created_at >= ? GROUP BY day, status`)
      .all(projectId, `${trend[0]!.date}T00:00:00.000Z`) as { day: string; status: ExecutionStatus; n: number }[];
    for (const t of trendRows) {
      const p = byDay.get(t.day);
      if (!p) continue;
      if (t.status === "passed") p.passed += t.n;
      else if (t.status === "failed") p.failed += t.n;
      else if (t.status === "needs_review") p.needsReview += t.n;
      else p.errors += t.n;
    }

    // Chatbot quality: which checks fail most often in the latest results.
    const chatbotLatest = latest.filter((r) => r.module === "chatbot");
    const failingChecks = new Map<string, number>();
    for (const r of chatbotLatest) {
      for (const c of parseJson<ExecutionDetails>(r.details, {}).checks ?? []) {
        if (c.outcome === "fail") failingChecks.set(c.label, (failingChecks.get(c.label) ?? 0) + 1);
      }
    }

    // Memory health: issue types and where conversations first break.
    const memoryLatest = latest.filter((r) => r.module === "memory");
    const issues = Object.fromEntries(MEMORY_ISSUES.map((i) => [i, 0])) as Record<MemoryIssueType, number>;
    const firstFailures: number[] = [];
    for (const r of memoryLatest) {
      const memory = parseJson<ExecutionDetails>(r.details, {}).memory;
      if (!memory) continue;
      for (const t of memory.transcript) for (const i of t.issues) issues[i.type]++;
      if (memory.firstFailureTurn) firstFailures.push(memory.firstFailureTurn);
    }

    // API performance over every request in range (not just the latest per endpoint).
    const apiRows = all.filter((r) => r.module === "api");
    const times: number[] = [];
    const errorKinds: Record<string, number> = {};
    const byEndpoint = new Map<string, number[]>();
    for (const r of apiRows) {
      const http = parseJson<ExecutionDetails>(r.details, {}).http;
      if (http?.errorKind) errorKinds[http.errorKind] = (errorKinds[http.errorKind] ?? 0) + 1;
      if (http?.timeMs != null) {
        times.push(http.timeMs);
        byEndpoint.set(r.input, [...(byEndpoint.get(r.input) ?? []), http.timeMs]);
      }
    }
    times.sort((a, b) => a - b);
    const slowest = [...byEndpoint]
      .map(([endpoint, t]) => ({ endpoint, avgMs: Math.round(t.reduce((s, x) => s + x, 0) / t.length), count: t.length }))
      .sort((a, b) => b.avgMs - a.avgMs)
      .slice(0, 3);

    const regression = regressionRepo.list(db, projectId).filter((r) => !from || r.createdAt >= from).slice(0, 10);

    return {
      range: { days: opts.days, from },
      totals: {
        executions: all.length,
        passed: count(all, "passed"),
        failed: count(all, "failed"),
        needsReview: count(all, "needs_review"),
        errors: count(all, "error"),
        mock: all.filter((r) => r.source === "mock").length,
        live: all.filter((r) => r.source === "live").length,
      },
      quality: { score, components },
      modules,
      trend,
      recent: [...all]
        .reverse()
        .slice(0, 8)
        .map((r) => ({ id: r.id, title: r.title, module: r.module, status: r.status, source: r.source, score: r.score, createdAt: r.created_at })),
      chatbot: {
        tests: chatbotLatest.length,
        avgScore: modules.find((m) => m.module === "chatbot")!.avgScore,
        topFailingChecks: [...failingChecks].map(([label, n]) => ({ label, count: n })).sort((a, b) => b.count - a.count).slice(0, 5),
      },
      memory: {
        scripts: memoryLatest.length,
        passRate: weightedRate(memoryLatest),
        issues,
        avgFirstFailureTurn: firstFailures.length ? round1(firstFailures.reduce((s, x) => s + x, 0) / firstFailures.length) : null,
      },
      api: {
        requests: apiRows.length,
        passRate: weightedRate(apiRows),
        errors: count(apiRows, "error"),
        blocked: errorKinds.blocked ?? 0,
        avgMs: times.length ? Math.round(times.reduce((s, x) => s + x, 0) / times.length) : null,
        p95Ms: percentile(times, 95),
        maxMs: times.length ? times[times.length - 1]! : null,
        errorKinds,
        slowest,
      },
      languages: multilingualService.summary(db, projectId),
      regression,
      bugs: bugService.summary(db, projectId),
    };
  },
};
