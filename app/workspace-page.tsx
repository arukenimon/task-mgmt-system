import { redirect } from "next/navigation";
import { TaskWorkspace, type WorkspaceView } from "@/features/tasks/views/task-workspace";
import { DEFAULT_FILTERS, type TaskFilters } from "@/features/tasks/models/task-filters";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { loadWorkspaceForCurrentUser } from "@/features/tasks/repositories/workspace.repository";

export type WorkspaceSearchParams = Record<string, string | string[] | undefined>;

type WorkspacePageProps = {
  searchParams: Promise<WorkspaceSearchParams>;
  view: WorkspaceView;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function filtersFromParams(params: WorkspaceSearchParams): TaskFilters {
  return {
    clientId: firstValue(params.client) ?? DEFAULT_FILTERS.clientId,
    teamId: firstValue(params.team) ?? DEFAULT_FILTERS.teamId,
    ownerId: firstValue(params.owner) ?? DEFAULT_FILTERS.ownerId,
    status: (firstValue(params.status) ?? DEFAULT_FILTERS.status) as TaskFilters["status"],
    priority: (firstValue(params.priority) ?? DEFAULT_FILTERS.priority) as TaskFilters["priority"],
    due: (firstValue(params.due) ?? DEFAULT_FILTERS.due) as TaskFilters["due"],
    query: firstValue(params.q) ?? DEFAULT_FILTERS.query,
  };
}

function taskViewFromParams(params: WorkspaceSearchParams): Exclude<WorkspaceView, "overview"> | undefined {
  const taskView = firstValue(params.taskView);
  return taskView === "list" || taskView === "calendar" || taskView === "board" ? taskView : undefined;
}

export async function WorkspacePage({ searchParams, view }: WorkspacePageProps) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const initialTaskView = taskViewFromParams(params);

  if (!hasSupabaseConfig) redirect("/login");
  const workspace = await loadWorkspaceForCurrentUser(view === "board" ? { kanbanFilters: filters } : undefined);
  if (!workspace) redirect("/login");

  return (
    <TaskWorkspace
      initialActorId={workspace.actorId}
      initialTasks={workspace.tasks}
      people={workspace.people}
      clients={workspace.clients}
      teams={workspace.teams}
      initialKanbanPages={workspace.kanbanPages}
      initialTaskView={initialTaskView}
      initialView={view}
      initialFilters={filters}
    />
  );
}
