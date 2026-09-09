import "server-only";

import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { createClient } from "@/lib/supabase/server";
import { TASK_PRIORITIES, TASK_STATUSES, type Client, type Person, type Task, type Team } from "@/features/tasks/models/task";
import { loadKanbanTaskPage } from "@/features/tasks/repositories/kanban.repository";
import type { InitialKanbanPages } from "@/features/tasks/models/kanban";
import { resolveTaskFiltersForActor, type TaskFilters } from "@/features/tasks/models/task-filters";

function assertRole(value: string): Person["role"] {
  if (value === "senior_director" || value === "account_director" || value === "team_member") return value;
  throw new Error("Profile has an invalid role.");
}

type WorkspaceLoadOptions = {
  kanbanFilters?: TaskFilters;
  hasExplicitOwnerFilter?: boolean;
};

async function loadInitialKanbanPages(filters: TaskFilters): Promise<InitialKanbanPages> {
  const [todo, inProgress, blocked, complete] = await Promise.all([
    loadKanbanTaskPage({ status: "todo", filters }),
    loadKanbanTaskPage({ status: "in_progress", filters }),
    loadKanbanTaskPage({ status: "blocked", filters }),
    loadKanbanTaskPage({ status: "complete", filters }),
  ]);

  return { todo, in_progress: inProgress, blocked, complete };
}

export async function loadWorkspaceForCurrentUser(options: WorkspaceLoadOptions = {}) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const [peopleResult, clientsResult, teamsResult] = await Promise.all([
    supabase.from("profiles").select("id,full_name,email,initials,role,team_id,is_active").order("full_name"),
    supabase.from("clients").select("id,name,account_lead_id,is_active").order("name"),
    supabase.from("teams").select("id,name").order("name"),
  ]);

  if (peopleResult.error || clientsResult.error || teamsResult.error) throw new Error("Unable to load workspace data.");

  const kanbanFilters = options.kanbanFilters
    ? resolveTaskFiltersForActor(options.kanbanFilters, profile, Boolean(options.hasExplicitOwnerFilter))
    : undefined;
  const kanbanPages = kanbanFilters ? await loadInitialKanbanPages(kanbanFilters) : undefined;
  const tasksResult = kanbanPages ? null : await supabase.from("tasks").select("id,title,description,client_id,team_id,created_by_id,status,priority,due_date,completed_at,created_at,task_assignees(profile_id)").order("due_date");
  if (tasksResult?.error) throw new Error("Unable to load workspace data.");

  const tasks: Task[] = kanbanPages ? Object.values(kanbanPages).flatMap((page) => page.tasks) : (tasksResult?.data ?? []).map((task) => {
    if (!TASK_STATUSES.includes(task.status as Task["status"]) || !TASK_PRIORITIES.includes(task.priority as Task["priority"])) throw new Error("Task contains invalid workflow data.");
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      clientId: task.client_id,
      teamId: task.team_id,
      assigneeIds: (task.task_assignees ?? []).map((assignee) => assignee.profile_id),
      createdById: task.created_by_id,
      status: task.status as Task["status"],
      priority: task.priority as Task["priority"],
      dueDate: task.due_date,
      completedAt: task.completed_at,
      createdAt: task.created_at,
    };
  });
  const people: Person[] = (peopleResult.data ?? []).map((person) => ({
    id: person.id,
    name: person.full_name,
    email: person.email,
    initials: person.initials,
    role: assertRole(person.role),
    teamId: person.team_id,
    isActive: person.is_active,
  }));
  const clients: Client[] = (clientsResult.data ?? []).map((client) => ({ id: client.id, name: client.name, accountLeadId: client.account_lead_id, isActive: client.is_active }));
  const teams: Team[] = (teamsResult.data ?? []).map((team, index) => ({ id: team.id, name: team.name, accent: index % 2 ? "violet" : "teal" }));
  return { actorId: profile.id, tasks, people, clients, teams, kanbanPages };
}
