"use server";

import { revalidatePath } from "next/cache";
import { allocateTask, getAuthenticatedProfile, getTask, getTaskAttachments, setTaskStatus, updateTask, uploadTaskAttachments } from "@/features/tasks/repositories/task.repository";
import { canAllocate, canChangeStatus, validateStatus, validateTaskAttachments, validateTaskId, validateTaskInput, validateTaskUpdateInput } from "@/features/tasks/services/task.service";

export async function createTaskAction(input: unknown) {
  const taskInput = validateTaskInput(input);
  const profile = await getAuthenticatedProfile();
  if (!canAllocate(profile.role)) throw new Error("Only managers can allocate tasks.");
  const teamId = await getTaskAssigneeTeam(taskInput.assigneeIds, profile.teamId);
  if (!teamId) throw new Error("A team is required to allocate this task.");
  const task = await allocateTask(teamId, taskInput);
  revalidateWorkspace();
  return task;
}

export async function createTaskWithAttachmentsAction(formData: FormData) {
  const taskInput = validateTaskInput({
    title: formData.get("title"),
    description: formData.get("description"),
    clientId: formData.get("clientId"),
    assigneeIds: formData.getAll("assigneeIds"),
    priority: formData.get("priority"),
    dueDate: formData.get("dueDate"),
  });
  const attachments = validateTaskAttachments(formData.getAll("attachments"));
  const profile = await getAuthenticatedProfile();
  if (!canAllocate(profile.role)) throw new Error("Only managers can allocate tasks.");

  const teamId = await getTaskAssigneeTeam(taskInput.assigneeIds, profile.teamId);
  if (!teamId) throw new Error("A team is required to allocate this task.");

  const task = await allocateTask(teamId, taskInput);
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
  if (!canChangeStatus(profile.role, profile.id, task.assigneeIds)) throw new Error("You can update only work assigned to you.");
  await setTaskStatus(validTaskId, nextStatus);
  revalidateWorkspace();
}

export async function updateTaskAction(input: unknown) {
  const taskInput = validateTaskUpdateInput(input);
  const [profile, task] = await Promise.all([getAuthenticatedProfile(), getTask(taskInput.taskId)]);
  if (!canAllocate(profile.role) || (profile.role === "account_director" && task.teamId !== profile.teamId)) {
    throw new Error("Only managers can edit tasks in their team.");
  }

  const teamId = await getTaskAssigneeTeam(taskInput.assigneeIds, profile.teamId);
  if (!teamId) throw new Error("Select active team members from one team.");

  await updateTask(teamId, taskInput);
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

async function getTaskAssigneeTeam(assigneeIds: string[], managerTeamId: string | null) {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("id, team_id, role, is_active").in("id", assigneeIds);
  if (error || !data || data.length !== assigneeIds.length || data.some((person) => person.role !== "team_member" || !person.team_id || !person.is_active)) {
    throw new Error("Select active team members.");
  }
  const teamIds = new Set(data.map((person) => person.team_id));
  if (teamIds.size !== 1) throw new Error("All assignees must belong to the same team.");
  const [teamId] = teamIds;
  if (managerTeamId && teamId !== managerTeamId) throw new Error("Account Directors can allocate work only within their own team.");
  return teamId;
}
