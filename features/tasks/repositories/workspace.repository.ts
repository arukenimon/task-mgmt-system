import "server-only";

import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { createClient } from "@/lib/supabase/server";
import { TASK_PRIORITIES, TASK_STATUSES, type Client, type Person, type Task, type Team } from "@/features/tasks/models/task";
import { loadKanbanTaskPage } from "@/features/tasks/repositories/kanban.repository";
import type { InitialKanbanPages } from "@/features/tasks/models/kanban";
import { TASK_LIST_PAGE_SIZE, type TaskPage } from "@/features/tasks/models/task-page";
import { loadTaskPage } from "@/features/tasks/repositories/task-page.repository";
import { DEFAULT_FILTERS, resolveTaskFiltersForActor, type TaskFilters } from "@/features/tasks/models/task-filters";

function assertRole(value: string): Person["role"] {
  if (value === "senior_director" || value === "account_director" || value === "team_member") return value;
  throw new Error("Profile has an invalid role.");
}

type WorkspaceLoadOptions = {
  filters?: TaskFilters;
  hasExplicitOwnerFilter?: boolean;
  taskStrategy?: "all" | "page" | "calendar" | "kanban";
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
  const startedAt = performance.now();
  const taskStrategy = options.taskStrategy ?? "all";
  if (process.env.NODE_ENV === "production") {
    console.info(JSON.stringify({ level: "info", message: "workspace load started", taskStrategy }));
  }

  let profileMs = 0;
  const profileStartedAt = performance.now();
  const profilePromise = getCurrentProfile().then((profile) => {
    profileMs = Math.round(performance.now() - profileStartedAt);
    return profile;
  });

  const supabase = await createClient();
  let referenceMs = 0;
  const referencesStartedAt = performance.now();
  const referenceDataPromise = Promise.all([
    supabase.from("profiles").select("id,full_name,email,initials,role,team_id,is_active").order("full_name"),
    supabase.from("clients").select("id,name,account_lead_id,is_active").order("name"),
    supabase.from("teams").select("id,name").order("name"),
  ]).then((results) => {
    referenceMs = Math.round(performance.now() - referencesStartedAt);
    return results;
  });
  let taskMs = 0;
  const allTasksStartedAt = performance.now();
  const allTasksPromise = taskStrategy === "all"
    ? supabase.from("tasks").select("id,title,description,client_id,team_id,created_by_id,status,priority,due_date,completed_at,created_at,task_assignees(profile_id)").order("due_date").then((result) => {
      taskMs = Math.round(performance.now() - allTasksStartedAt);
      return result;
    })
    : Promise.resolve(null);

  const profile = await profilePromise;
  if (!profile) return null;

  const filters = resolveTaskFiltersForActor(options.filters ?? DEFAULT_FILTERS, profile, Boolean(options.hasExplicitOwnerFilter));
  const tasksStartedAt = performance.now();
  const taskPagePromise: Promise<TaskPage | undefined> = taskStrategy === "page"
    ? loadTaskPage({ filters, pageSize: TASK_LIST_PAGE_SIZE }).then((page) => {
      taskMs = Math.round(performance.now() - tasksStartedAt);
      return page;
    })
    : Promise.resolve(undefined);
  const kanbanPagesPromise: Promise<InitialKanbanPages | undefined> = taskStrategy === "kanban"
    ? loadInitialKanbanPages(filters).then((pages) => {
      taskMs = Math.round(performance.now() - tasksStartedAt);
      return pages;
    })
    : Promise.resolve(undefined);

  const [[peopleResult, clientsResult, teamsResult], tasksResult, taskPage, kanbanPages] = await Promise.all([
    referenceDataPromise,
    allTasksPromise,
    taskPagePromise,
    kanbanPagesPromise,
  ]);
  if (peopleResult.error || clientsResult.error || teamsResult.error) throw new Error("Unable to load workspace data.");
  if (tasksResult?.error) throw new Error("Unable to load workspace data.");

  const tasks: Task[] = taskPage?.tasks ?? (kanbanPages ? Object.values(kanbanPages).flatMap((page) => page.tasks) : (tasksResult?.data ?? []).map((task) => {
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
  }));
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
  if (process.env.NODE_ENV === "production") {
    console.info(JSON.stringify({
      level: "info",
      message: "workspace load completed",
      taskStrategy,
      totalMs: Math.round(performance.now() - startedAt),
      profileMs,
      referenceMs,
      taskMs,
      taskRows: tasks.length,
    }));
  }
  return { actorId: profile.id, tasks, people, clients, teams, filters, taskPage, kanbanPages };
}
