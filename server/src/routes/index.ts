import { Router } from "express";
import { apiStudioController, settingsController } from "../controllers/apiStudioController";
import { projectController } from "../controllers/projectController";
import { bugController, regressionController } from "../controllers/qualityController";
import { demoController, preferencesController, reportController } from "../controllers/reportController";
import {
  conversationController,
  executionController,
  multilingualController,
  providerController,
  suiteController,
  testCaseController,
} from "../controllers/testingController";
import type { AppMeta } from "@testmate/shared";
import { getDb, sendOk } from "../lib/http";
import { publicPolicy } from "../lib/publicMode";
import { requireProject } from "../middleware/projectScope";

/** Routes for one project's data, mounted at /api/projects/:projectId. */
function createProjectScopedRouter(): Router {
  const r = Router({ mergeParams: true });

  r.get("/suites", suiteController.list);
  r.post("/suites", suiteController.create);
  r.patch("/suites/:id", suiteController.update);
  r.delete("/suites/:id", suiteController.remove);
  r.post("/suites/:id/run", suiteController.run);

  r.get("/test-cases", testCaseController.list);
  r.post("/test-cases", testCaseController.create);
  r.get("/test-cases/:id", testCaseController.get);
  r.put("/test-cases/:id", testCaseController.update);
  r.delete("/test-cases/:id", testCaseController.remove);
  r.post("/test-cases/:id/run", testCaseController.run);

  r.get("/conversations", conversationController.list);
  r.post("/conversations", conversationController.create);
  r.get("/conversations/:id", conversationController.get);
  r.put("/conversations/:id", conversationController.update);
  r.delete("/conversations/:id", conversationController.remove);
  r.post("/conversations/:id/run", conversationController.run);

  r.get("/executions", executionController.list);
  r.get("/executions/:id", executionController.get);
  r.patch("/executions/:id/override", executionController.override);

  r.get("/multilingual/summary", multilingualController.summary);
  r.post("/multilingual/samples", multilingualController.addSamples);

  r.post("/api-studio/send", apiStudioController.send);
  r.get("/api-studio/history", apiStudioController.history);
  r.delete("/api-studio/history", apiStudioController.clearHistory);
  r.delete("/api-studio/history/:id", apiStudioController.removeHistory);
  r.get("/api-studio/saved", apiStudioController.listSaved);
  r.post("/api-studio/saved", apiStudioController.createSaved);
  r.put("/api-studio/saved/:id", apiStudioController.updateSaved);
  r.delete("/api-studio/saved/:id", apiStudioController.removeSaved);
  r.post("/api-studio/saved/:id/run", apiStudioController.runSaved);

  r.post("/regression/runs", regressionController.run);
  r.get("/regression/runs", regressionController.list);
  r.get("/regression/compare", regressionController.compare);
  r.get("/regression/runs/:id", regressionController.get);
  r.delete("/regression/runs/:id", regressionController.remove);

  r.get("/bugs", bugController.list);
  r.get("/bugs/summary", bugController.summary);
  r.get("/bugs/suggest", bugController.suggest);
  r.post("/bugs", bugController.create);
  r.get("/bugs/:id", bugController.get);
  r.patch("/bugs/:id", bugController.update);
  r.delete("/bugs/:id", bugController.remove);

  r.get("/analytics", reportController.analytics);
  r.get("/reports/executions.csv", reportController.executionsCsv);
  r.get("/reports/regression.csv", reportController.regressionCsv);
  r.get("/reports/report.pdf", reportController.pdf);

  r.get("/provider/target", providerController.getTarget);
  r.put("/provider/target", providerController.setTarget);
  r.get("/provider/mock", providerController.getMock);
  r.put("/provider/mock", providerController.setMock);

  return r;
}

export function createApiRouter(): Router {
  const api = Router();

  api.get("/health", (_req, res) => sendOk(res, { status: "ok" }));
  api.get("/meta", (req, res) => {
    const policy = publicPolicy(getDb(req));
    const meta: AppMeta = { publicMode: !!policy, limits: policy ? policy.limits : null };
    sendOk(res, meta);
  });
  // Lets the UI confirm an admin key. In public mode the guard checks the key before this runs;
  // without public mode there is no admin key, so this always answers ok.
  api.get("/admin/check", (_req, res) => sendOk(res, { admin: true }));
  api.post("/language/detect", multilingualController.detect);
  api.get("/settings/api-studio", settingsController.getApiStudio);
  api.put("/settings/api-studio", settingsController.setApiStudio);
  api.get("/settings/preferences", preferencesController.get);
  api.put("/settings/preferences", preferencesController.set);
  api.post("/demo", demoController.seed);
  api.delete("/demo", demoController.clear);

  api.get("/projects", projectController.list);
  api.post("/projects", projectController.create);
  api.get("/projects/:id", projectController.get);
  api.patch("/projects/:id", projectController.update);
  api.delete("/projects/:id", projectController.remove);

  api.use("/projects/:projectId", requireProject, createProjectScopedRouter());

  return api;
}
