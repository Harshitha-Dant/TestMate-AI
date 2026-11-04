import type { ProjectWithStats } from "@testmate/shared";
import type { Db } from "../db/connection";
import { projectRepo } from "../db/repositories/projectRepo";
import { conflict, notFound } from "../lib/errors";

function assertNameFree(db: Db, name: string, exceptId?: number): void {
  const taken = projectRepo.list(db).some((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== exceptId);
  if (taken) throw conflict(`A project named "${name}" already exists`);
}

export const projectService = {
  list: (db: Db) => projectRepo.list(db),

  get(db: Db, id: number): ProjectWithStats {
    const project = projectRepo.get(db, id);
    if (!project) throw notFound("Project");
    return project;
  },

  create(db: Db, input: { name: string; description: string }): ProjectWithStats {
    assertNameFree(db, input.name);
    const id = projectRepo.create(db, input);
    return projectService.get(db, id);
  },

  update(db: Db, id: number, input: { name?: string; description?: string }): ProjectWithStats {
    projectService.get(db, id);
    if (input.name !== undefined) assertNameFree(db, input.name, id);
    projectRepo.update(db, id, input);
    return projectService.get(db, id);
  },

  /** Deletes the project and, via ON DELETE CASCADE, everything scoped to it. */
  remove(db: Db, id: number): void {
    if (!projectRepo.remove(db, id)) throw notFound("Project");
  },
};
