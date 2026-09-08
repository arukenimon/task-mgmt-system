import { z } from "zod";

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(""),
  // PostgreSQL accepts UUID-shaped values regardless of RFC UUID version.
  // The seeded assessment IDs use a version-0 segment, so `uuid()` rejects
  // legitimate foreign keys before the repository can persist the task.
  clientId: z.guid(),
  assigneeIds: z.array(z.guid()).min(1, "Select at least one assignee.").max(50),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.iso.date(),
});

export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "complete"]);
export const taskIdSchema = z.guid();
export const taskUpdateInputSchema = taskInputSchema.extend({ taskId: taskIdSchema });

export type TaskInput = z.infer<typeof taskInputSchema>;
export type TaskUpdateInput = z.infer<typeof taskUpdateInputSchema>;
