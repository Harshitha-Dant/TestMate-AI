import type { Request, Response } from "express";
import { clearDemo, seedDemo } from "../db/seed";
import { getDb, sendOk } from "../lib/http";
import { projectIdOf } from "../middleware/projectScope";
import { analyticsService } from "../services/analyticsService";
import { reportService } from "../services/reportService";
import { settingsService } from "../services/settingsService";
import { preferencesSchema, rangeQuery } from "../validators/reports";

function sendFile(res: Response, file: { name: string; body: string | Buffer }, type: string) {
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
  res.setHeader("Cache-Control", "no-store");
  res.send(file.body);
}

export const reportController = {
  analytics(req: Request, res: Response) {
    const { days } = rangeQuery.parse(req.query);
    sendOk(res, analyticsService.overview(getDb(req), projectIdOf(res), { days }));
  },
  executionsCsv(req: Request, res: Response) {
    const { days } = rangeQuery.parse(req.query);
    sendFile(res, reportService.executionsCsv(getDb(req), projectIdOf(res), days), "text/csv; charset=utf-8");
  },
  regressionCsv(req: Request, res: Response) {
    sendFile(res, reportService.regressionCsv(getDb(req), projectIdOf(res)), "text/csv; charset=utf-8");
  },
  async pdf(req: Request, res: Response) {
    const { days } = rangeQuery.parse(req.query);
    sendFile(res, await reportService.pdf(getDb(req), projectIdOf(res), days), "application/pdf");
  },
};

export const preferencesController = {
  get(req: Request, res: Response) {
    sendOk(res, settingsService.getPreferences(getDb(req)));
  },
  set(req: Request, res: Response) {
    sendOk(res, settingsService.setPreferences(getDb(req), preferencesSchema.parse(req.body)));
  },
};

/** Demo data is clearly labeled (is_demo, "Demo:" project) and can be removed without touching user data. */
export const demoController = {
  async seed(req: Request, res: Response) {
    sendOk(res, await seedDemo(getDb(req)), 201);
  },
  clear(req: Request, res: Response) {
    sendOk(res, { removed: clearDemo(getDb(req)) });
  },
};
