import type { Request, Response } from "express";
import { getDb, sendOk } from "../lib/http";
import { projectService } from "../services/projectService";
import { idParams } from "../validators/common";
import { createProjectSchema, updateProjectSchema } from "../validators/project";

export const projectController = {
  list(req: Request, res: Response) {
    sendOk(res, projectService.list(getDb(req)));
  },

  get(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    sendOk(res, projectService.get(getDb(req), id));
  },

  create(req: Request, res: Response) {
    const input = createProjectSchema.parse(req.body);
    sendOk(res, projectService.create(getDb(req), input), 201);
  },

  update(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    const input = updateProjectSchema.parse(req.body);
    sendOk(res, projectService.update(getDb(req), id, input));
  },

  remove(req: Request, res: Response) {
    const { id } = idParams.parse(req.params);
    projectService.remove(getDb(req), id);
    sendOk(res, { id });
  },
};
