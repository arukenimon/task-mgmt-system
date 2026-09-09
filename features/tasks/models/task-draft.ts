import type { TaskPriority } from "@/features/tasks/models/task";

export type TaskDraft = {
  title: string;
  description: string;
  clientId: string;
  assigneeIds: string[];
  priority: TaskPriority;
  dueDate: string;
};
