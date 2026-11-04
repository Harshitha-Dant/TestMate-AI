import {
  BUG_SEVERITIES,
  BUG_STATUSES,
  type Bug,
  type BugCategory,
  type BugDetail,
  type BugInput,
  type BugSeverity,
  type BugSummary,
  type BugUpdate,
  type Execution,
} from "@testmate/shared";
import type { Db } from "../db/connection";
import { bugRepo, type BugFilter } from "../db/repositories/bugRepo";
import { executionRepo } from "../db/repositories/executionRepo";
import { badRequest, notFound } from "../lib/errors";

const MAX_TITLE = 120;
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** Stable item identity for executions of saved tests (API history entries have none). */
function itemKeyOf(e: Execution): string | null {
  if (e.testCaseId) return `case:${e.testCaseId}`;
  if (e.sessionId) return `script:${e.sessionId}`;
  return null;
}

/** Picks a category from what the execution's checks found. Transparent heuristics, editable by the user. */
function categoryFor(e: Execution): BugCategory {
  const failed = (id: string) => e.details.checks?.some((c) => c.id === id && c.outcome === "fail");
  if (e.module === "memory") {
    const turn = e.details.memory?.transcript.find((t) => t.status !== "passed");
    const issue = turn?.issues[0]?.type;
    if (issue === "context_loss") return "context_loss";
    if (issue === "wrong_memory" || issue === "contradiction") return "wrong_memory";
    return "wrong_answer";
  }
  if (e.module === "multilingual" && failed("language")) return "wrong_language";
  if (e.module === "api") {
    if (e.details.http?.errorKind === "blocked") return "security";
    if (failed("time")) return "performance";
    return "api_failure";
  }
  return "wrong_answer";
}

function severityFor(e: Execution, category: BugCategory): BugSeverity {
  if (e.effectiveStatus === "error" || category === "security") return "high";
  const failed = (id: string) => e.details.checks?.some((c) => c.id === id && c.outcome === "fail");
  if (failed("forbidden") || category === "wrong_memory" || category === "wrong_language") return "high";
  if (e.effectiveStatus === "needs_review") return "low";
  return "medium";
}

export const bugService = {
  /** A prefilled bug draft for a failed execution. Nothing is saved. */
  suggestFromExecution(db: Db, projectId: number, executionId: number): BugInput {
    const e = executionRepo.get(db, projectId, executionId);
    if (!e) throw notFound("Execution");
    const category = categoryFor(e);
    const firstProblem = e.explanation.split(/(?<=\.)\s/)[0] ?? "";
    const firstTurn = e.details.memory?.firstFailureTurn;
    return {
      title: clip(`${e.title}: ${firstProblem || "test did not pass"}`, MAX_TITLE),
      module: e.module,
      category,
      severity: severityFor(e, category),
      failureExplanation: e.explanation,
      notes: [
        `Input: ${clip(e.input, 500)}`,
        firstTurn ? `First failing turn: ${firstTurn}` : null,
        e.source === "mock" ? "Found with the simulated (mock) chatbot, not a live AI." : null,
      ]
        .filter(Boolean)
        .join("\n"),
      executionId: e.id,
    };
  },

  create(db: Db, projectId: number, input: BugInput, opts: { isDemo?: boolean } = {}): Bug {
    let itemKey: string | null = null;
    if (input.executionId) {
      const e = executionRepo.get(db, projectId, input.executionId);
      if (!e) throw badRequest("The linked execution doesn't exist in this project");
      itemKey = itemKeyOf(e);
    }
    const id = db.transaction(() => {
      const bugId = bugRepo.insert(db, projectId, { ...input, executionId: input.executionId ?? null, itemKey, isDemo: opts.isDemo });
      bugRepo.addHistory(db, bugId, { action: "created", note: input.executionId ? `Reported from execution #${input.executionId}` : "Reported manually" });
      return bugId;
    })();
    return bugRepo.get(db, projectId, id)!;
  },

  /**
   * Opens a regression bug for a newly failing item, unless an unresolved bug already tracks it;
   * then the existing bug gets a history note instead. Returns the new bug id or null.
   */
  createForRegression(
    db: Db,
    projectId: number,
    r: { runId: number; label: string; itemKey: string; executionId: number | null },
    opts: { isDemo?: boolean } = {},
  ): number | null {
    const existing = bugRepo.findOpenByItem(db, projectId, r.itemKey);
    if (existing) {
      bugRepo.addHistory(db, existing.id, { action: "commented", note: `Failed again in regression run "${r.label}".` });
      bugRepo.touch(db, existing.id);
      return null;
    }
    if (!r.executionId) return null;
    const draft = bugService.suggestFromExecution(db, projectId, r.executionId);
    const id = db.transaction(() => {
      const bugId = bugRepo.insert(db, projectId, {
        ...draft,
        title: clip(`Regression: ${draft.title}`, MAX_TITLE),
        category: "regression",
        severity: draft.severity === "low" ? "medium" : "high",
        failureExplanation: `Passed in the baseline run, fails in "${r.label}". ${draft.failureExplanation}`,
        executionId: r.executionId,
        regressionRunId: r.runId,
        itemKey: r.itemKey,
        isDemo: opts.isDemo,
      });
      bugRepo.addHistory(db, bugId, { action: "created", note: `Opened automatically by regression run "${r.label}"` });
      return bugId;
    })();
    return id;
  },

  list: (db: Db, projectId: number, filter: BugFilter) => bugRepo.list(db, projectId, filter),

  get(db: Db, projectId: number, id: number): BugDetail {
    const bug = bugRepo.get(db, projectId, id);
    if (!bug) throw notFound("Bug");
    return {
      ...bug,
      history: bugRepo.history(db, id),
      execution: bug.executionId ? (executionRepo.get(db, projectId, bug.executionId) ?? null) : null,
    };
  },

  /** Applies changes and records one history entry per changed field (with the optional comment). */
  update(db: Db, projectId: number, id: number, changes: BugUpdate): BugDetail {
    const bug = bugRepo.get(db, projectId, id);
    if (!bug) throw notFound("Bug");
    const fields = (["title", "category", "severity", "status", "notes"] as const).filter(
      (f) => changes[f] !== undefined && changes[f] !== bug[f],
    );
    const comment = changes.comment?.trim() || null;
    if (!fields.length && !comment) return bugService.get(db, projectId, id);

    db.transaction(() => {
      bugRepo.update(db, projectId, id, Object.fromEntries(fields.map((f) => [f, changes[f]])));
      fields.forEach((f, i) =>
        bugRepo.addHistory(db, id, {
          action: "updated",
          field: f,
          // Long notes are not copied into history; the entry just records that they changed.
          oldValue: f === "notes" ? null : String(bug[f]),
          newValue: f === "notes" ? null : String(changes[f]),
          note: i === 0 ? comment : null,
        }),
      );
      if (!fields.length && comment) {
        bugRepo.addHistory(db, id, { action: "commented", note: comment });
        bugRepo.touch(db, id);
      }
    })();
    return bugService.get(db, projectId, id);
  },

  remove(db: Db, projectId: number, id: number): void {
    if (!bugRepo.remove(db, projectId, id)) throw notFound("Bug");
  },

  summary(db: Db, projectId: number): BugSummary {
    const byStatus = Object.fromEntries(BUG_STATUSES.map((s) => [s, 0])) as BugSummary["byStatus"];
    const openBySeverity = Object.fromEntries(BUG_SEVERITIES.map((s) => [s, 0])) as BugSummary["openBySeverity"];
    let total = 0;
    for (const row of bugRepo.counts(db, projectId)) {
      total += row.n;
      byStatus[row.status] += row.n;
      if (row.status === "open" || row.status === "in_progress") openBySeverity[row.severity] += row.n;
    }
    return { total, byStatus, openBySeverity };
  },
};
