import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/features/tasks/models/task";
import type { KanbanTaskPageRequest } from "@/features/tasks/models/kanban";

const identifier = z.union([z.literal("all"), z.string().uuid()]);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const requestSchema = z.object({
  clientId: identifier.default("all"),
  teamId: identifier.default("all"),
  ownerId: identifier.default("all"),
  status: z.enum(TASK_STATUSES),
  filterStatus: z.union([z.literal("all"), z.enum(TASK_STATUSES)]).default("all"),
  priority: z.union([z.literal("all"), z.enum(TASK_PRIORITIES)]).default("all"),
  due: z.enum(["all", "overdue", "today", "week"]).default("all"),
  query: z.string().trim().max(160).default(""),
  cursorDueDate: dateKey.optional(),
  cursorId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.cursorDueDate) === Boolean(value.cursorId), {
  message: "A cursor must include both its due date and task id.",
});

export function parseKanbanTaskPageRequest(params: URLSearchParams): KanbanTaskPageRequest {
  const parsed = requestSchema.safeParse({
    clientId: params.get("client") ?? "all",
    teamId: params.get("team") ?? "all",
    ownerId: params.get("owner") ?? "all",
    status: params.get("status"),
    filterStatus: params.get("filterStatus") ?? "all",
    priority: params.get("priority") ?? "all",
    due: params.get("due") ?? "all",
    query: params.get("q") ?? "",
    cursorDueDate: params.get("cursorDueDate") ?? undefined,
    cursorId: params.get("cursorId") ?? undefined,
  });

  if (!parsed.success) throw new Error("The Kanban page request is invalid.");

  const { cursorDueDate, cursorId, filterStatus, ...query } = parsed.data;
  return {
    ...query,
    filters: {
      clientId: query.clientId,
      teamId: query.teamId,
      ownerId: query.ownerId,
      status: filterStatus,
      priority: query.priority,
      due: query.due,
      query: query.query,
    },
    cursor: cursorDueDate && cursorId ? { dueDate: cursorDueDate, id: cursorId } : null,
  };
}
