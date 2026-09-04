import "server-only";

import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { createClient } from "@/lib/supabase/server";
import { TASK_PRIORITIES, TASK_STATUSES, type Client, type Person, type Task, type Team } from "@/features/tasks/models/task";

function assertRole(value: string): Person["role"] {
  if (value === "senior_director" || value === "account_director" || value === "team_member") return value;
  throw new Error("Profile has an invalid role.");
}

export async function loadWorkspaceForCurrentUser() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const supabase = await createClient();
  const [tasksResult, peopleResult, clientsResult, teamsResult] = await Promise.all([
    supabase.from("tasks").select("id,title,description,client_id,team_id,owner_id,created_by_id,status,priority,due_date,completed_at,created_at").order("due_date"),
    supabase.from("profiles").select("id,full_name,email,initials,role,team_id,is_active").order("full_name"),
    supabase.from("clients").select("id,name,account_lead_id").order("name"),
    supabase.from("teams").select("id,name").order("name"),
  ]);

  if (tasksResult.error || peopleResult.error || clientsResult.error || teamsResult.error) throw new Error("Unable to load workspace data.");

  const tasks: Task[] = (tasksResult.data ?? []).map((task) => {
    if (!TASK_STATUSES.includes(task.status as Task["status"]) || !TASK_PRIORITIES.includes(task.priority as Task["priority"])) throw new Error("Task contains invalid workflow data.");
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      clientId: task.client_id,
      teamId: task.team_id,
      ownerId: task.owner_id,
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
  const clients: Client[] = (clientsResult.data ?? []).map((client) => ({ id: client.id, name: client.name, accountLeadId: client.account_lead_id }));
  const teams: Team[] = (teamsResult.data ?? []).map((team, index) => ({ id: team.id, name: team.name, accent: index % 2 ? "violet" : "teal" }));
  return { actorId: profile.id, tasks, people, clients, teams };
}
