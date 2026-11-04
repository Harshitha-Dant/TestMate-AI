import type { Request, Response } from "express";
import { z } from "zod";
import { getDb, sendOk } from "../lib/http";
import { projectIdOf } from "../middleware/projectScope";
import { conversationService } from "../services/conversationService";
import { detectLanguage } from "../lib/languageDetect";
import { executionService } from "../services/executionService";
import { multilingualService } from "../services/multilingualService";
import { providerService } from "../services/providerService";
import { runService } from "../services/runService";
import { suiteService } from "../services/suiteService";
import { testCaseService } from "../services/testCaseService";
import { idParams } from "../validators/common";
import {
  caseListQuery,
  chatbotTargetSchema,
  conversationSchema,
  detectLanguageSchema,
  executionListQuery,
  mockConfigSchema,
  moduleQuery,
  multilingualCaseSchema,
  overrideSchema,
  suiteCreateSchema,
  suiteUpdateSchema,
  testCaseSchema,
} from "../validators/testing";

const caseModule = z.object({ module: z.enum(["chatbot", "multilingual"]).default("chatbot") });
const schemaFor = (module: "chatbot" | "multilingual") => (module === "multilingual" ? multilingualCaseSchema : testCaseSchema);

export const suiteController = {
  list(req: Request, res: Response) {
    const { module } = moduleQuery.parse(req.query);
    sendOk(res, suiteService.list(getDb(req), projectIdOf(res), module));
  },
  create(req: Request, res: Response) {
    sendOk(res, suiteService.create(getDb(req), projectIdOf(res), suiteCreateSchema.parse(req.body)), 201);
  },
  update(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, suiteService.update(getDb(req), projectIdOf(res), id, suiteUpdateSchema.parse(req.body)));
  },
  remove(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    suiteService.remove(getDb(req), projectIdOf(res), id);
    sendOk(res, { id });
  },
  async run(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, await runService.runSuite(getDb(req), projectIdOf(res), id));
  },
};

export const testCaseController = {
  list(req: Request, res: Response) {
    const { module } = caseModule.parse(req.query);
    const { suiteId } = caseListQuery.parse(req.query);
    sendOk(res, testCaseService.list(getDb(req), projectIdOf(res), module, suiteId));
  },
  get(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, testCaseService.get(getDb(req), projectIdOf(res), id));
  },
  create(req: Request, res: Response) {
    const { module } = caseModule.parse(req.body ?? {});
    const input = schemaFor(module).parse(req.body);
    sendOk(res, testCaseService.create(getDb(req), projectIdOf(res), module, input), 201);
  },
  update(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    const db = getDb(req);
    const existing = testCaseService.get(db, projectIdOf(res), id);
    const input = schemaFor(existing.module).parse(req.body);
    sendOk(res, testCaseService.update(db, projectIdOf(res), id, existing.module, input));
  },
  remove(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    const db = getDb(req);
    const existing = testCaseService.get(db, projectIdOf(res), id);
    testCaseService.remove(db, projectIdOf(res), id, existing.module);
    sendOk(res, { id });
  },
  async run(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    const db = getDb(req);
    const testCase = testCaseService.get(db, projectIdOf(res), id);
    sendOk(res, await runService.runTestCase(db, projectIdOf(res), testCase), 201);
  },
};

export const conversationController = {
  list(req: Request, res: Response) {
    const { suiteId } = caseListQuery.parse(req.query);
    sendOk(res, conversationService.list(getDb(req), projectIdOf(res), suiteId));
  },
  get(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, conversationService.get(getDb(req), projectIdOf(res), id));
  },
  create(req: Request, res: Response) {
    sendOk(res, conversationService.create(getDb(req), projectIdOf(res), conversationSchema.parse(req.body)), 201);
  },
  update(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, conversationService.update(getDb(req), projectIdOf(res), id, conversationSchema.parse(req.body)));
  },
  remove(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    conversationService.remove(getDb(req), projectIdOf(res), id);
    sendOk(res, { id });
  },
  async run(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    const db = getDb(req);
    const script = conversationService.get(db, projectIdOf(res), id);
    sendOk(res, await runService.runConversation(db, projectIdOf(res), script), 201);
  },
};

export const executionController = {
  list(req: Request, res: Response) {
    sendOk(res, executionService.list(getDb(req), projectIdOf(res), executionListQuery.parse(req.query)));
  },
  get(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, executionService.get(getDb(req), projectIdOf(res), id));
  },
  override(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, executionService.override(getDb(req), projectIdOf(res), id, overrideSchema.parse(req.body)));
  },
};

export const multilingualController = {
  summary(req: Request, res: Response) {
    sendOk(res, multilingualService.summary(getDb(req), projectIdOf(res)));
  },
  addSamples(req: Request, res: Response) {
    sendOk(res, multilingualService.addSamples(getDb(req), projectIdOf(res)), 201);
  },
  detect(req: Request, res: Response) {
    const { text } = detectLanguageSchema.parse(req.body);
    sendOk(res, detectLanguage(text));
  },
};

export const providerController = {
  getTarget(req: Request, res: Response) {
    sendOk(res, providerService.getTarget(getDb(req), projectIdOf(res)));
  },
  setTarget(req: Request, res: Response) {
    sendOk(res, providerService.setTarget(getDb(req), projectIdOf(res), chatbotTargetSchema.parse(req.body)));
  },
  getMock(req: Request, res: Response) {
    sendOk(res, providerService.getMockConfig(getDb(req), projectIdOf(res)));
  },
  setMock(req: Request, res: Response) {
    sendOk(res, providerService.setMockConfig(getDb(req), projectIdOf(res), mockConfigSchema.parse(req.body)));
  },
};
