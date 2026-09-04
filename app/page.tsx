import { TaskWorkspace } from "@/features/tasks/views/task-workspace";
import { demoClients, demoPeople, demoTasks, demoTeams } from "@/features/tasks/models/task";
import { DEFAULT_FILTERS, type TaskFilters } from "@/features/tasks/models/task-filters";
import { hasSupabaseConfig } from "@/lib/supabase/env";
import { loadWorkspaceForCurrentUser } from "@/features/tasks/repositories/workspace.repository";
import { redirect } from "next/navigation";

type HomeProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function filtersFromParams(params: Record<string, string | string[] | undefined>): TaskFilters {
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

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const filters = filtersFromParams(params);
  const view = firstValue(params.view);
  if (hasSupabaseConfig) {
    const workspace = await loadWorkspaceForCurrentUser();
    if (!workspace) redirect("/login");
    return (
      <TaskWorkspace
        initialActorId={workspace.actorId}
        initialTasks={workspace.tasks}
        people={workspace.people}
        clients={workspace.clients}
        teams={workspace.teams}
        initialView={view}
        initialFilters={filters}
        isDemo={false}
      />
    );
  }
  const demoActor = firstValue(params.as);
  const actorId = demoPeople.some((person) => person.id === demoActor) ? demoActor! : "director-1";

  return (
    <TaskWorkspace
      initialActorId={actorId}
      initialTasks={demoTasks}
      clients={demoClients}
      people={demoPeople}
      teams={demoTeams}
      initialView={view}
      initialFilters={filters}
      isDemo
    />
  );
}
