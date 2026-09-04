import { canManageTeamWork, type Role } from "@/features/identity/models/roles";
import { taskInputSchema, taskStatusSchema, type TaskInput } from "@/features/tasks/models/task.schemas";
import type { TaskStatus } from "@/features/tasks/models/task";

export function validateTaskInput(input: unknown): TaskInput {
  return taskInputSchema.parse(input);
}

export function validateStatus(status: unknown): TaskStatus {
  return taskStatusSchema.parse(status);
}

export function canAllocate(role: Role) {
  return canManageTeamWork(role);
}

export function canChangeStatus(role: Role, actorId: string, ownerId: string) {
  return canManageTeamWork(role) || actorId === ownerId;
}
