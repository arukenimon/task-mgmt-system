import "server-only";

import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { createClient } from "@/lib/supabase/server";
import type { TaskInput } from "@/features/tasks/models/task.schemas";
import type { TaskStatus } from "@/features/tasks/models/task";

export async function getAuthenticatedProfile() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("You must be signed in with an assigned Bespoke profile.");
  return profile;
}

export async function getTask(taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("id, team_id, owner_id, status").eq("id", taskId).single();
  if (error || !data) throw new Error("Task not found or not available to this account.");
  return data;
}

export async function insertTask(actorId: string, teamId: string, input: TaskInput) {
  const supabase = await createClient();
  const { data: owner, error: ownerError } = await supabase.from("profiles").select("team_id, role, is_active").eq("id", input.ownerId).single();
  if (ownerError || !owner || owner.role !== "team_member" || owner.team_id !== teamId || !owner.is_active) throw new Error("The owner must be an active member of the selected team.");
  const { data, error } = await supabase.from("tasks").insert({
    title: input.title,
    description: input.description,
    client_id: input.clientId,
    team_id: teamId,
    owner_id: input.ownerId,
    created_by_id: actorId,
    priority: input.priority,
    due_date: input.dueDate,
  }).select("id").single();
  if (error) throw new Error("The task could not be allocated.");
  return data;
}

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status, completed_at: status === "complete" ? new Date().toISOString() : null }).eq("id", taskId);
  if (error) throw new Error("The task status could not be updated.");
}
