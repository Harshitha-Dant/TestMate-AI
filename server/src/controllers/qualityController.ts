import type { Request, Response } from "express";
import { getDb, sendOk } from "../lib/http";
import { projectIdOf } from "../middleware/projectScope";
import { bugService } from "../services/bugService";
import { regressionService } from "../services/regressionService";
import { idParams } from "../validators/common";
import {
  bugInputSchema,
  bugListQuery,
  bugUpdateSchema,
  compareQuery,
  regressionListQuery,
  regressionRunSchema,
  suggestQuery,
} from "../validators/quality";

export const regressionController = {
  async run(req: Request, res: Response) {
    sendOk(res, await regressionService.run(getDb(req), projectIdOf(res), regressionRunSchema.parse(req.body)), 201);
  },
  list(req: Request, res: Response) {
    const { suiteId } = regressionListQuery.parse(req.query);
    sendOk(res, regressionService.list(getDb(req), projectIdOf(res), suiteId));
  },
  get(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, regressionService.detail(getDb(req), projectIdOf(res), id));
  },
  compare(req: Request, res: Response) {
    const { from, to } = compareQuery.parse(req.query);
    sendOk(res, regressionService.diff(getDb(req), projectIdOf(res), from, to));
  },
  remove(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    regressionService.remove(getDb(req), projectIdOf(res), id);
    sendOk(res, { id });
  },
};

export const bugController = {
  list(req: Request, res: Response) {
    sendOk(res, bugService.list(getDb(req), projectIdOf(res), bugListQuery.parse(req.query)));
  },
  summary(req: Request, res: Response) {
    sendOk(res, bugService.summary(getDb(req), projectIdOf(res)));
  },
  suggest(req: Request, res: Response) {
    const { executionId } = suggestQuery.parse(req.query);
    sendOk(res, bugService.suggestFromExecution(getDb(req), projectIdOf(res), executionId));
  },
  create(req: Request, res: Response) {
    sendOk(res, bugService.create(getDb(req), projectIdOf(res), bugInputSchema.parse(req.body)), 201);
  },
  get(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, bugService.get(getDb(req), projectIdOf(res), id));
  },
  update(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, bugService.update(getDb(req), projectIdOf(res), id, bugUpdateSchema.parse(req.body)));
  },
  remove(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    bugService.remove(getDb(req), projectIdOf(res), id);
    sendOk(res, { id });
  },
};
