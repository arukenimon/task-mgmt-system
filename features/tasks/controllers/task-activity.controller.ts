import { z } from "zod";
import type { TaskActivityPageRequest } from "@/features/tasks/models/task-activity";

const requestSchema = z.object({
  taskId: z.guid(),
  cursorCreatedAt: z.iso.datetime({ offset: true }).optional(),
  cursorId: z.guid().optional(),
}).refine((value) => Boolean(value.cursorCreatedAt) === Boolean(value.cursorId), {
  message: "An activity cursor must include both its timestamp and id.",
});

export function parseTaskActivityPageRequest(params: URLSearchParams): TaskActivityPageRequest {
  const parsed = requestSchema.safeParse({
    taskId: params.get("taskId"),
    cursorCreatedAt: params.get("cursorCreatedAt") ?? undefined,
    cursorId: params.get("cursorId") ?? undefined,
  });
  if (!parsed.success) throw new Error("The activity request is invalid.");

  return {
    taskId: parsed.data.taskId,
    cursor: parsed.data.cursorCreatedAt && parsed.data.cursorId
      ? { createdAt: parsed.data.cursorCreatedAt, id: parsed.data.cursorId }
      : null,
  };
}
