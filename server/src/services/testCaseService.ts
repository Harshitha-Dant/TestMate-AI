import type { TestCase } from "@testmate/shared";
import type { Db } from "../db/connection";
import { testCaseRepo, type CaseWrite } from "../db/repositories/testCaseRepo";
import { notFound } from "../lib/errors";
import { suiteService } from "./suiteService";

type CaseModule = TestCase["module"];

export const testCaseService = {
  list: (db: Db, projectId: number, module: CaseModule, suiteId?: number | "none") =>
    testCaseRepo.list(db, projectId, { module, suiteId }),

  get(db: Db, projectId: number, id: number, module?: CaseModule): TestCase {
    const testCase = testCaseRepo.get(db, projectId, id);
    if (!testCase || (module && testCase.module !== module)) throw notFound("Test case");
    return testCase;
  },

  create(db: Db, projectId: number, module: CaseModule, input: CaseWrite): TestCase {
    if (input.suiteId !== null) suiteService.assertInModule(db, projectId, input.suiteId, module);
    const id = testCaseRepo.create(db, projectId, module, input);
    return testCaseService.get(db, projectId, id);
  },

  update(db: Db, projectId: number, id: number, module: CaseModule, input: CaseWrite): TestCase {
    testCaseService.get(db, projectId, id, module);
    if (input.suiteId !== null) suiteService.assertInModule(db, projectId, input.suiteId, module);
    testCaseRepo.update(db, projectId, id, input);
    return testCaseService.get(db, projectId, id);
  },

  remove(db: Db, projectId: number, id: number, module: CaseModule): void {
    testCaseService.get(db, projectId, id, module);
    testCaseRepo.remove(db, projectId, id);
  },
};
