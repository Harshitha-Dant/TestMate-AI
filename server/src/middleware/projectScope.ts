import type { RequestHandler, Response } from "express";
import { notFound } from "../lib/errors";
import { getDb } from "../lib/http";
import { projectIdParams } from "../validators/common";

/** Validates :projectId and confirms the project exists before any project-scoped route runs. */
export const requireProject: RequestHandler = (req, res, next) => {
  const { projectId } = projectIdParams.parse(req.params);
  const exists = getDb(req).prepare("SELECT 1 FROM projects WHERE id = ?").get(projectId);
  if (!exists) throw notFound("Project");
  res.locals.projectId = projectId;
  next();
};

export function projectIdOf(res: Response): number {
  return res.locals.projectId as number;
}
