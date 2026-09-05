import { z } from "zod";

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(""),
  // PostgreSQL accepts UUID-shaped values regardless of RFC UUID version.
  // The seeded assessment IDs use a version-0 segment, so `uuid()` rejects
  // legitimate foreign keys before the repository can persist the task.
  clientId: z.guid(),
  ownerId: z.guid(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.iso.date(),
});

export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "complete"]);
export const taskIdSchema = z.guid();

export type TaskInput = z.infer<typeof taskInputSchema>;
