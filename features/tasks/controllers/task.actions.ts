"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getTask, getTaskAttachments, insertTask, setTaskStatus, uploadTaskAttachments } from "@/features/tasks/repositories/task.repository";
import { canAllocate, canChangeStatus, validateStatus, validateTaskAttachments, validateTaskId, validateTaskInput } from "@/features/tasks/services/task.service";

export async function createTaskAction(input: unknown) {
  const taskInput = validateTaskInput(input);
  const profile = await getAuthenticatedProfile();
  if (!canAllocate(profile.role)) throw new Error("Only managers can allocate tasks.");
  const teamId = profile.role === "senior_director"
    ? (await getTaskOwnerTeam(taskInput.ownerId))
    : profile.teamId;
  if (!teamId) throw new Error("A team is required to allocate this task.");
  const task = await insertTask(profile.id, teamId, taskInput);
  revalidateWorkspace();
  return task;
}

export async function createTaskWithAttachmentsAction(formData: FormData) {
  const taskInput = validateTaskInput({
    title: formData.get("title"),
    description: formData.get("description"),
    clientId: formData.get("clientId"),
    ownerId: formData.get("ownerId"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
  });
  const attachments = validateTaskAttachments(formData.getAll("attachments"));
  const profile = await getAuthenticatedProfile();
  if (!canAllocate(profile.role)) throw new Error("Only managers can allocate tasks.");

  const teamId = profile.role === "senior_director"
    ? (await getTaskOwnerTeam(taskInput.ownerId))
    : profile.teamId;
  if (!teamId) throw new Error("A team is required to allocate this task.");

  const task = await insertTask(profile.id, teamId, taskInput);
  let attachmentError: string | null = null;
  if (attachments.length > 0) {
    try {
      await uploadTaskAttachments(task.id, profile.id, attachments);
    } catch {
      attachmentError = "The task was allocated, but its images could not be saved.";
    }
  }

  revalidateWorkspace();
  return { taskId: task.id, attachmentError };
}

export async function updateTaskStatusAction(taskId: string, status: unknown) {
  const validTaskId = validateTaskId(taskId);
  const nextStatus = validateStatus(status);
  const [profile, task] = await Promise.all([getAuthenticatedProfile(), getTask(validTaskId)]);
  if (!canChangeStatus(profile.role, profile.id, task.owner_id)) throw new Error("You can update only work assigned to you.");
  await setTaskStatus(validTaskId, nextStatus);
  revalidateWorkspace();
}

export async function getTaskAttachmentsAction(taskId: string) {
  const validTaskId = validateTaskId(taskId);
  await getAuthenticatedProfile();
  return getTaskAttachments(validTaskId);
}

function revalidateWorkspace() {
  for (const path of ["/", "/overview", "/list", "/calendar", "/kanban"]) revalidatePath(path);
}

async function getTaskOwnerTeam(ownerId: string) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("team_id, role, is_active").eq("id", ownerId).single();
  if (error || !data || data.role !== "team_member" || !data.team_id || !data.is_active) throw new Error("Select an active team member.");
  return data.team_id;
}
