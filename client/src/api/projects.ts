import type { ProjectInput, ProjectWithStats } from "@testmate/shared";
import { apiRequest } from "./client";

export const projectsApi = {
  list: () => apiRequest<ProjectWithStats[]>("/projects"),
  get: (id: number) => apiRequest<ProjectWithStats>(`/projects/${id}`),
  create: (input: ProjectInput) => apiRequest<ProjectWithStats>("/projects", { method: "POST", body: input }),
  update: (id: number, input: Partial<ProjectInput>) =>
    apiRequest<ProjectWithStats>(`/projects/${id}`, { method: "PATCH", body: input }),
  remove: (id: number) => apiRequest<{ id: number }>(`/projects/${id}`, { method: "DELETE" }),
};
