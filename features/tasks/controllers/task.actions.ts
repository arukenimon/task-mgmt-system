"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getTask, insertTask, setTaskStatus } from "@/features/tasks/repositories/task.repository";
import { canAllocate, canChangeStatus, validateStatus, validateTaskInput } from "@/features/tasks/services/task.service";

export async function createTaskAction(input: unknown) {
  const taskInput = validateTaskInput(input);
  const profile = await getAuthenticatedProfile();
  if (!canAllocate(profile.role)) throw new Error("Only managers can allocate tasks.");
  const teamId = profile.role === "senior_director"
    ? (await getTaskOwnerTeam(taskInput.ownerId))
    : profile.teamId;
  if (!teamId) throw new Error("A team is required to allocate this task.");
  const task = await insertTask(profile.id, teamId, taskInput);
  revalidatePath("/");
  return task;
}

export async function updateTaskStatusAction(taskId: string, status: unknown) {
  const nextStatus = validateStatus(status);
  const [profile, task] = await Promise.all([getAuthenticatedProfile(), getTask(taskId)]);
  if (!canChangeStatus(profile.role, profile.id, task.owner_id)) throw new Error("You can update only work assigned to you.");
  await setTaskStatus(taskId, nextStatus);
  revalidatePath("/");
}

async function getTaskOwnerTeam(ownerId: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("team_id, role, is_active").eq("id", ownerId).single();
  if (error || !data || data.role !== "team_member" || !data.team_id || !data.is_active) throw new Error("Select an active team member.");
  return data.team_id;
}
