import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ProjectWithStats } from "@testmate/shared";
import { projectsApi } from "../api/projects";
import { useAsync } from "../hooks/useAsync";

const STORAGE_KEY = "testmate.activeProjectId";

function readStoredId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? Number(raw) : null;
  } catch {
    return null;
  }
}

function writeStoredId(id: number): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(id));
  } catch {
    // Storage can be unavailable (private mode); the selection then lasts for this tab only.
  }
}

interface ProjectContextValue {
  projects: ProjectWithStats[];
  loading: boolean;
  error?: Error;
  /** The selected project, falling back to the first one; null when there are no projects. */
  active: ProjectWithStats | null;
  setActiveId: (id: number) => void;
  reload: () => void;
  /** Re-fetch without showing a loading state (after mutations). */
  refresh: () => void;
}

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { data, loading, error, reload, refresh } = useAsync(projectsApi.list);
  const [selectedId, setSelectedId] = useState<number | null>(readStoredId);

  const setActiveId = useCallback((id: number) => {
    setSelectedId(id);
    writeStoredId(id);
  }, []);

  const value = useMemo<ProjectContextValue>(() => {
    const projects = data ?? [];
    const active = projects.find((p) => p.id === selectedId) ?? projects[0] ?? null;
    return { projects, loading, error, active, setActiveId, reload, refresh };
  }, [data, loading, error, selectedId, setActiveId, reload, refresh]);

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProjects(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) throw new Error("useProjects must be used inside <ProjectProvider>");
  return ctx;
}
