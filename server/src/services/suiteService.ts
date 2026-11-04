import type { TestModule, TestSuite } from "@testmate/shared";
import type { Db } from "../db/connection";
import { suiteRepo } from "../db/repositories/suiteRepo";
import { badRequest, conflict, notFound } from "../lib/errors";

function assertNameFree(db: Db, projectId: number, module: TestModule, name: string, exceptId?: number) {
  const existing = suiteRepo.findByName(db, projectId, module, name);
  if (existing && existing.id !== exceptId) throw conflict(`A suite named "${name}" already exists`);
}

export const suiteService = {
  list: (db: Db, projectId: number, module?: TestModule) => suiteRepo.list(db, projectId, module),

  get(db: Db, projectId: number, id: number): TestSuite {
    const suite = suiteRepo.get(db, projectId, id);
    if (!suite) throw notFound("Suite");
    return suite;
  },

  /** Throws unless the suite exists in this project and belongs to `module`. */
  assertInModule(db: Db, projectId: number, id: number, module: TestModule): TestSuite {
    const suite = suiteService.get(db, projectId, id);
    if (suite.module !== module) throw badRequest(`Suite "${suite.name}" belongs to the ${suite.module} module`);
    return suite;
  },

  create(db: Db, projectId: number, input: { module: TestModule; name: string; description: string }): TestSuite {
    assertNameFree(db, projectId, input.module, input.name);
    const id = suiteRepo.create(db, projectId, input.module, input);
    return suiteService.get(db, projectId, id);
  },

  update(db: Db, projectId: number, id: number, input: { name?: string; description?: string }): TestSuite {
    const suite = suiteService.get(db, projectId, id);
    if (input.name !== undefined) assertNameFree(db, projectId, suite.module, input.name, id);
    suiteRepo.update(db, projectId, id, input);
    return suiteService.get(db, projectId, id);
  },

  remove(db: Db, projectId: number, id: number): void {
    if (!suiteRepo.remove(db, projectId, id)) throw notFound("Suite");
  },
};
