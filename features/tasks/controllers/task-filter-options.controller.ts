import { z } from "zod";
import { TASK_FILTER_OPTION_KINDS, type TaskFilterOptionPageRequest } from "@/features/tasks/models/task-filter-options";

const requestSchema = z.object({
  kind: z.enum(TASK_FILTER_OPTION_KINDS),
  query: z.string().trim().max(160).default(""),
  cursorLabel: z.string().min(1).max(160).optional(),
  cursorId: z.guid().optional(),
}).refine((value) => Boolean(value.cursorLabel) === Boolean(value.cursorId), {
  message: "A filter cursor must include both its label and id.",
});

export function parseTaskFilterOptionPageRequest(params: URLSearchParams): TaskFilterOptionPageRequest {
  const parsed = requestSchema.safeParse({
    kind: params.get("kind"),
    query: params.get("q") ?? "",
    cursorLabel: params.get("cursorLabel") ?? undefined,
    cursorId: params.get("cursorId") ?? undefined,
  });
  if (!parsed.success) throw new Error("The filter option request is invalid.");

  return {
    kind: parsed.data.kind,
    query: parsed.data.query,
    cursor: parsed.data.cursorLabel && parsed.data.cursorId ? { label: parsed.data.cursorLabel, id: parsed.data.cursorId } : null,
  };
}
