import type { Request, Response } from "express";
import { getDb, sendOk } from "../lib/http";
import { projectIdOf } from "../middleware/projectScope";
import { apiStudioService } from "../services/apiStudioService";
import { settingsService } from "../services/settingsService";
import {
  apiRequestSchema,
  apiStudioSettingsSchema,
  historyQuery,
  savedQuery,
  savedRequestSchema,
} from "../validators/apiStudio";
import { idParams } from "../validators/common";

export const apiStudioController = {
  async send(req: Request, res: Response) {
    const input = apiRequestSchema.parse(req.body);
    sendOk(res, await apiStudioService.send(getDb(req), projectIdOf(res), input), 201);
  },
  history(req: Request, res: Response) {
    const { limit } = historyQuery.parse(req.query);
    sendOk(res, apiStudioService.history(getDb(req), projectIdOf(res), limit));
  },
  removeHistory(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    apiStudioService.removeHistory(getDb(req), projectIdOf(res), id);
    sendOk(res, { id });
  },
  clearHistory(req: Request, res: Response) {
    sendOk(res, apiStudioService.clearHistory(getDb(req), projectIdOf(res)));
  },
  listSaved(req: Request, res: Response) {
    const { suiteId } = savedQuery.parse(req.query);
    sendOk(res, apiStudioService.listSaved(getDb(req), projectIdOf(res), suiteId));
  },
  createSaved(req: Request, res: Response) {
    sendOk(res, apiStudioService.createSaved(getDb(req), projectIdOf(res), savedRequestSchema.parse(req.body)), 201);
  },
  updateSaved(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, apiStudioService.updateSaved(getDb(req), projectIdOf(res), id, savedRequestSchema.parse(req.body)));
  },
  removeSaved(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    apiStudioService.removeSaved(getDb(req), projectIdOf(res), id);
    sendOk(res, { id });
  },
  async runSaved(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, await apiStudioService.runSaved(getDb(req), projectIdOf(res), id), 201);
  },
};

export const settingsController = {
  getApiStudio(req: Request, res: Response) {
    sendOk(res, settingsService.getApiStudio(getDb(req)));
  },
  setApiStudio(req: Request, res: Response) {
    sendOk(res, settingsService.setApiStudio(getDb(req), apiStudioSettingsSchema.parse(req.body)));
  },
};
