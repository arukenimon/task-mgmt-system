import { z } from "zod";
import { TASK_CALENDAR_PAGE_SIZE, TASK_LIST_PAGE_SIZE, type TaskPageRequest } from "@/features/tasks/models/task-page";
import { TASK_PRIORITIES, TASK_STATUSES } from "@/features/tasks/models/task";

const identifier = z.union([z.literal("all"), z.guid()]);
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const requestSchema = z.object({
  clientId: identifier.default("all"),
  teamId: identifier.default("all"),
  ownerId: identifier.default("all"),
  status: z.union([z.literal("all"), z.enum(TASK_STATUSES)]).default("all"),
  priority: z.union([z.literal("all"), z.enum(TASK_PRIORITIES)]).default("all"),
  due: z.enum(["all", "overdue", "today", "week"]).default("all"),
  query: z.string().trim().max(160).default(""),
  cursorDueDate: dateKey.optional(),
  cursorId: z.guid().optional(),
  startDate: dateKey.optional(),
  endDate: dateKey.optional(),
  pageSize: z.coerce.number().int().min(1).max(TASK_CALENDAR_PAGE_SIZE).default(TASK_LIST_PAGE_SIZE),
}).refine((value) => Boolean(value.cursorDueDate) === Boolean(value.cursorId), {
  message: "A cursor must include both its due date and task id.",
}).refine((value) => Boolean(value.startDate) === Boolean(value.endDate), {
  message: "A date range must include both its start and end date.",
}).refine((value) => !value.startDate || !value.endDate || value.startDate <= value.endDate, {
  message: "A date range must end on or after its start date.",
});

export function parseTaskPageRequest(params: URLSearchParams): TaskPageRequest {
  const parsed = requestSchema.safeParse({
    clientId: params.get("client") ?? "all",
    teamId: params.get("team") ?? "all",
    ownerId: params.get("owner") ?? "all",
    status: params.get("status") ?? "all",
    priority: params.get("priority") ?? "all",
    due: params.get("due") ?? "all",
    query: params.get("q") ?? "",
    cursorDueDate: params.get("cursorDueDate") ?? undefined,
    cursorId: params.get("cursorId") ?? undefined,
    startDate: params.get("startDate") ?? undefined,
    endDate: params.get("endDate") ?? undefined,
    pageSize: params.get("pageSize") ?? undefined,
  });

  if (!parsed.success) throw new Error("The task page request is invalid.");

  const { cursorDueDate, cursorId, startDate, endDate, pageSize, ...filters } = parsed.data;
  return {
    filters,
    cursor: cursorDueDate && cursorId ? { dueDate: cursorDueDate, id: cursorId } : null,
    dateRange: startDate && endDate ? { startDate, endDate } : null,
    pageSize,
  };
}
