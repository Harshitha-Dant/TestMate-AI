import { FolderKanban, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import type { ProjectWithStats } from "@testmate/shared";
import { Badge } from "../../components/ui/Badge";
import { Button, IconButton } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { PageHeader } from "../../components/ui/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../../components/ui/States";
import { useProjects } from "../../context/ProjectContext";
import { cn } from "../../lib/cn";
import { DeleteProjectDialog } from "./DeleteProjectDialog";
import { ProjectFormModal } from "./ProjectFormModal";

export function ProjectsPage() {
  const { projects, active, setActiveId, loading, error, reload, refresh } = useProjects();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editing, setEditing] = useState<ProjectWithStats | null>(null);
  const [deleting, setDeleting] = useState<ProjectWithStats | null>(null);

  // "?new=1" opens the create form, so the sidebar switcher can link straight to it.
  const creating = searchParams.get("new") === "1";
  const openCreate = () => setSearchParams({ new: "1" });
  const closeCreate = () => setSearchParams({});

  const newButton = (
    <Button variant="primary" icon={<Plus className="size-4" aria-hidden />} onClick={openCreate}>
      New project
    </Button>
  );

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Projects"
        description="Each project keeps its own suites, runs, bugs and reports."
        actions={projects.length > 0 && newButton}
      />

      {loading ? (
        <Card>
          <LoadingState label="Loading projects…" />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error.message} onRetry={reload} />
        </Card>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="size-5" aria-hidden />}
            title="No projects yet"
            description={
              <>
                Create a project for the chatbot or API you want to test. To explore with sample data instead, run{" "}
                <code className="rounded bg-card-2 px-1 py-0.5 text-xs text-fg">npm run db:seed</code>.
              </>
            }
            action={newButton}
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => {
            const isActive = p.id === active?.id;
            return (
              <Card
                key={p.id}
                className={cn("flex flex-col p-5 transition-colors", isActive && "border-accent/30")}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h2 className="truncate text-base font-semibold">{p.name}</h2>
                      {isActive && <Badge tone="accent">Active</Badge>}
                      {p.isDemo && <Badge tone="warning">Demo data</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-muted">{p.description || "No description"}</p>
                  </div>
                  <div className="flex shrink-0">
                    <IconButton label={`Edit ${p.name}`} icon={<Pencil className="size-3.5" aria-hidden />} onClick={() => setEditing(p)} />
                    <IconButton
                      label={`Delete ${p.name}`}
                      icon={<Trash2 className="size-3.5" aria-hidden />}
                      className="hover:text-failure"
                      onClick={() => setDeleting(p)}
                    />
                  </div>
                </div>

                <dl className="mt-5 grid grid-cols-4 gap-2">
                  {[
                    ["Suites", p.stats.suites],
                    ["Tests", p.stats.testCases],
                    ["Runs", p.stats.executions],
                    ["Bugs", p.stats.openBugs],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl bg-card-2 px-2.5 py-2">
                      <dt className="truncate text-[11px] text-muted">{label}</dt>
                      <dd className="text-lg font-semibold tabular-nums">{value}</dd>
                    </div>
                  ))}
                </dl>

                <div className="mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
                  <span className="text-xs text-muted">Created {new Date(p.createdAt).toLocaleDateString()}</span>
                  <Button size="sm" variant={isActive ? "ghost" : "secondary"} disabled={isActive} onClick={() => setActiveId(p.id)}>
                    {isActive ? "Current project" : "Switch to project"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <ProjectFormModal
          open
          onClose={closeCreate}
          onSaved={(p) => {
            setActiveId(p.id);
            refresh();
            closeCreate();
          }}
        />
      )}
      {editing && (
        <ProjectFormModal
          key={editing.id}
          open
          project={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            refresh();
            setEditing(null);
          }}
        />
      )}
      <DeleteProjectDialog
        key={deleting?.id}
        project={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={() => {
          refresh();
          setDeleting(null);
        }}
      />
    </div>
  );
}
