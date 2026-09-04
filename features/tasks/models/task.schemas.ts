import { z } from "zod";

export const taskInputSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).default(""),
  clientId: z.string().uuid(),
  ownerId: z.string().uuid(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  dueDate: z.iso.date(),
});

export const taskStatusSchema = z.enum(["todo", "in_progress", "blocked", "complete"]);

export type TaskInput = z.infer<typeof taskInputSchema>;
