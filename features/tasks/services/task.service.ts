import { canManageTeamWork, type Role } from "@/features/identity/models/roles";
import { taskIdSchema, taskInputSchema, taskStatusSchema, type TaskInput } from "@/features/tasks/models/task.schemas";
import { MAX_TASK_ATTACHMENT_BYTES, MAX_TASK_ATTACHMENTS, TASK_ATTACHMENT_ACCEPTED_TYPES } from "@/features/tasks/models/task-attachment";
import type { TaskStatus } from "@/features/tasks/models/task";

export function validateTaskInput(input: unknown): TaskInput {
  return taskInputSchema.parse(input);
}

export function validateStatus(status: unknown): TaskStatus {
  return taskStatusSchema.parse(status);
}

export function validateTaskId(taskId: unknown) {
  return taskIdSchema.parse(taskId);
}

export function canAllocate(role: Role) {
  return canManageTeamWork(role);
}

export function canChangeStatus(role: Role, actorId: string, ownerId: string) {
  return canManageTeamWork(role) || actorId === ownerId;
}

export function validateTaskAttachments(value: FormDataEntryValue[]) {
  const files = value.filter((entry): entry is File => entry instanceof File && entry.size > 0);
  if (files.length > MAX_TASK_ATTACHMENTS) throw new Error(`Attach at most ${MAX_TASK_ATTACHMENTS} images.`);

  for (const file of files) {
    if (!TASK_ATTACHMENT_ACCEPTED_TYPES.includes(file.type as (typeof TASK_ATTACHMENT_ACCEPTED_TYPES)[number])) {
      throw new Error("Attachments must be PNG, JPEG, or WebP images.");
    }
    if (file.size > MAX_TASK_ATTACHMENT_BYTES) throw new Error("Each image must be 5 MB or smaller.");
    if (!file.name || file.name.length > 255) throw new Error("Each image needs a valid file name.");
  }

  return files;
}
