import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { TaskInput } from "@/features/tasks/models/task.schemas";
import type { TaskStatus } from "@/features/tasks/models/task";

export async function getAuthenticatedProfile() {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) throw new Error("You must be signed in.");
  const { data: profile, error } = await supabase.from("profiles").select("id, role, team_id").eq("id", authData.user.id).single();
  if (error || !profile) throw new Error("Your profile is not configured.");
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
  const { data: owner, error: ownerError } = await supabase.from("profiles").select("team_id, role").eq("id", input.ownerId).single();
  if (ownerError || !owner || owner.role !== "team_member" || owner.team_id !== teamId) throw new Error("The owner must be a member of the selected team.");
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
