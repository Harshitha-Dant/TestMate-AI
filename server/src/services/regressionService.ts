import { REGRESSION_CHANGES, type RegressionDiff, type RegressionRunInput, type RegressionRunResponse } from "@testmate/shared";
import type { Db } from "../db/connection";
import { regressionRepo } from "../db/repositories/regressionRepo";
import { badRequest, notFound } from "../lib/errors";
import { diffRuns, passRate } from "../lib/regressionDiff";
import { bugService } from "./bugService";
import { runService } from "./runService";
import { suiteService } from "./suiteService";

function countChanges(diff: Pick<RegressionDiff, "results" | "removed">): RegressionDiff["counts"] {
  const counts = Object.fromEntries(REGRESSION_CHANGES.map((c) => [c, 0])) as RegressionDiff["counts"];
  for (const r of diff.results) counts[r.change]++;
  counts.removed = diff.removed.length;
  return counts;
}

export const regressionService = {
  /**
   * Snapshots a suite: runs every item, compares each with the baseline run (default: the suite's previous run),
   * stores the per-item change, and optionally opens bugs for newly introduced failures.
   */
  async run(db: Db, projectId: number, input: RegressionRunInput, opts: { isDemo?: boolean } = {}): Promise<RegressionRunResponse> {
    const suite = suiteService.get(db, projectId, input.suiteId);
    if (suite.itemCount === 0) throw badRequest(`Suite "${suite.name}" has no tests to run`);

    let baselineRunId = input.baselineRunId ?? regressionRepo.latestForSuite(db, projectId, suite.id)?.id ?? null;
    if (baselineRunId !== null) {
      const baseline = regressionRepo.get(db, projectId, baselineRunId);
      if (!baseline) throw notFound("Baseline run");
      if (baseline.suiteId !== suite.id) throw badRequest("The baseline run belongs to a different suite");
      baselineRunId = baseline.id;
    }

    const label = input.label?.trim() || `Run ${regressionRepo.list(db, projectId, suite.id).length + 1}`;
    const runId = regressionRepo.createRun(db, projectId, { suiteId: suite.id, baselineRunId, label, isDemo: opts.isDemo });
    const items = await runService.runSuiteItems(db, projectId, suite.id, { regressionRunId: runId, isDemo: opts.isDemo });

    const current = items.map((i) => ({ itemKey: i.itemKey, title: i.title, status: i.execution.status, executionId: i.execution.id }));
    const baseline = baselineRunId ? regressionRepo.results(db, baselineRunId) : [];
    const { results } = diffRuns(baseline, current);
    const count = (s: string) => current.filter((c) => c.status === s).length;
    regressionRepo.finishRun(
      db,
      runId,
      {
        total: current.length,
        passed: count("passed"),
        failed: count("failed"),
        needsReview: count("needs_review"),
        errors: count("error"),
        passRate: passRate(count("passed"), current.length),
      },
      results,
    );

    const bugsCreated: number[] = [];
    if (input.createBugs) {
      for (const r of results.filter((x) => x.change === "new_failure")) {
        const id = bugService.createForRegression(db, projectId, { runId, label, itemKey: r.itemKey, executionId: r.executionId }, opts);
        if (id !== null) bugsCreated.push(id);
      }
    }
    return { diff: regressionService.diff(db, projectId, baselineRunId, runId), bugsCreated };
  },

  list: (db: Db, projectId: number, suiteId?: number) => regressionRepo.list(db, projectId, suiteId),

  /** Diff between any two runs of the same suite (from = null means "compare with nothing": everything is new). */
  diff(db: Db, projectId: number, fromId: number | null, toId: number): RegressionDiff {
    const to = regressionRepo.get(db, projectId, toId);
    if (!to) throw notFound("Regression run");
    const from = fromId === null ? null : (regressionRepo.get(db, projectId, fromId) ?? null);
    if (fromId !== null && !from) throw notFound("Regression run");
    if (from && from.suiteId !== to.suiteId) throw badRequest("Only runs of the same suite can be compared");

    const toItems = regressionRepo.results(db, to.id);
    const fromItems = from ? regressionRepo.results(db, from.id) : [];
    const { results, removed } = diffRuns(fromItems, toItems);
    return { from, to, results, removed, counts: countChanges({ results, removed }) };
  },

  /** A run compared with the baseline it was taken against. */
  detail(db: Db, projectId: number, runId: number): RegressionDiff {
    const run = regressionRepo.get(db, projectId, runId);
    if (!run) throw notFound("Regression run");
    return regressionService.diff(db, projectId, run.baselineRunId, run.id);
  },

  remove(db: Db, projectId: number, id: number): void {
    if (!regressionRepo.remove(db, projectId, id)) throw notFound("Regression run");
  },
};
