import type { ProjectWithStats } from "@testmate/shared";
import { FolderKanban } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "../context/ProjectContext";
import { Card } from "./ui/Card";
import { EmptyState, ErrorState, LoadingState } from "./ui/States";

/** Renders children only when there is an active project; otherwise a loading, error or empty state. */
export function RequireProject({ children }: { children: (project: ProjectWithStats) => ReactNode }) {
  const { active, loading, error, reload } = useProjects();
  if (loading) return <LoadingState />;
  if (error) {
    return (
      <Card>
        <ErrorState message={error.message} onRetry={reload} />
      </Card>
    );
  }
  if (!active) {
    return (
      <Card>
        <EmptyState
          icon={<FolderKanban className="size-5" aria-hidden />}
          title="No project selected"
          description="Create a project first. Everything you test is stored inside a project."
          action={
            <Link to="/projects?new=1" className="text-sm text-accent hover:underline">
              Create a project
            </Link>
          }
        />
      </Card>
    );
  }
  return <>{children(active)}</>;
}
