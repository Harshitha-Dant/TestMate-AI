import type { Execution, OverrideInput } from "@testmate/shared";
import type { Db } from "../db/connection";
import { executionRepo, type ExecutionFilter } from "../db/repositories/executionRepo";
import { badRequest, notFound } from "../lib/errors";

export const executionService = {
  list: (db: Db, projectId: number, filter: ExecutionFilter) => executionRepo.list(db, projectId, filter),

  get(db: Db, projectId: number, id: number): Execution {
    const execution = executionRepo.get(db, projectId, id);
    if (!execution) throw notFound("Execution");
    return execution;
  },

  /** Manual review: sets or clears a human verdict. The evaluator's original status is kept. */
  override(db: Db, projectId: number, id: number, input: { status: OverrideInput["status"]; note: string }): Execution {
    const execution = executionService.get(db, projectId, id);
    if (input.status !== null && input.status === execution.status && !execution.override) {
      throw badRequest("The override matches the evaluator's verdict; there is nothing to override");
    }
    executionRepo.setOverride(db, projectId, id, input.status, input.status === null ? null : input.note);
    return executionService.get(db, projectId, id);
  },
};
