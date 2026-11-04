import type { Db } from "../db/connection";
import { executionRepo } from "../db/repositories/executionRepo";
import { regressionRepo } from "../db/repositories/regressionRepo";
import { toCsv } from "../lib/csv";
import { buildPdfReport } from "../lib/pdfReport";
import { analyticsService } from "./analyticsService";
import { projectService } from "./projectService";

const MAX_EXPORT_ROWS = 50_000;

export function rangeLabel(days: number | null): string {
  return days ? `last ${days} days` : "all time";
}

/** File name like testmate-support-bot-executions-2026-11-04.csv */
export function exportFileName(projectName: string, kind: string, ext: string): string {
  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
  return `testmate-${slug}-${kind}-${new Date().toISOString().slice(0, 10)}.${ext}`;
}

export const reportService = {
  executionsCsv(db: Db, projectId: number, days: number | null): { name: string; body: string } {
    const project = projectService.get(db, projectId);
    const { items } = executionRepo.list(db, projectId, { days: days ?? undefined, limit: MAX_EXPORT_ROWS, offset: 0 });
    const body = toCsv(
      ["id", "created_at", "module", "title", "status", "evaluator_status", "overridden", "override_note", "score", "source",
        "evaluator", "duration_ms", "reply_language", "regression_run_id", "input", "explanation"],
      items.map((e) => [
        e.id,
        e.createdAt,
        e.module,
        e.title,
        e.effectiveStatus,
        e.status,
        e.override ? "yes" : "no",
        e.override?.note ?? "",
        e.score,
        e.source,
        e.evaluator,
        e.durationMs,
        e.language,
        e.regressionRunId,
        e.input,
        e.explanation,
      ]),
    );
    return { name: exportFileName(project.name, "executions", "csv"), body };
  },

  regressionCsv(db: Db, projectId: number): { name: string; body: string } {
    const project = projectService.get(db, projectId);
    const runs = regressionRepo.list(db, projectId);
    const body = toCsv(
      ["id", "created_at", "suite", "module", "label", "total", "passed", "failed", "needs_review", "errors", "pass_rate",
        "baseline_pass_rate", "pass_rate_delta", "new_failures", "fixed"],
      runs.map((r) => [
        r.id, r.createdAt, r.suiteName, r.module, r.label, r.total, r.passed, r.failed, r.needsReview, r.errors, r.passRate,
        r.baselinePassRate, r.passRateDelta, r.newFailures, r.fixed,
      ]),
    );
    return { name: exportFileName(project.name, "regression-runs", "csv"), body };
  },

  async pdf(db: Db, projectId: number, days: number | null): Promise<{ name: string; body: Buffer }> {
    const project = projectService.get(db, projectId);
    const analytics = analyticsService.overview(db, projectId, { days });
    const body = await buildPdfReport(analytics, { projectName: project.name, rangeLabel: rangeLabel(days), generatedAt: new Date() });
    return { name: exportFileName(project.name, "report", "pdf"), body };
  },
};
