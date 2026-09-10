import type { TaskFilters } from "@/features/tasks/models/task-filters";
import type { TaskDateRange, TaskPage } from "@/features/tasks/models/task-page";

export function taskFilterKey(filters: TaskFilters) {
  return [filters.clientId, filters.teamId, filters.ownerId, filters.status, filters.priority, filters.due, filters.query];
}

export function sameTaskFilters(left: TaskFilters, right: TaskFilters) {
  return taskFilterKey(left).every((value, index) => value === taskFilterKey(right)[index]);
}

export async function fetchTaskPage(filters: TaskFilters, options: {
  cursor?: TaskPage["nextCursor"];
  dateRange?: TaskDateRange | null;
  pageSize?: number;
}, signal: AbortSignal): Promise<TaskPage> {
  const params = new URLSearchParams({
    client: filters.clientId,
    team: filters.teamId,
    owner: filters.ownerId,
    status: filters.status,
    priority: filters.priority,
    due: filters.due,
    q: filters.query,
  });
  if (options.cursor) {
    params.set("cursorDueDate", options.cursor.dueDate);
    params.set("cursorId", options.cursor.id);
  }
  if (options.dateRange) {
    params.set("startDate", options.dateRange.startDate);
    params.set("endDate", options.dateRange.endDate);
  }
  if (options.pageSize) params.set("pageSize", String(options.pageSize));

  const response = await fetch(`/api/tasks?${params.toString()}`, { signal });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Unable to load tasks.");
  }
  return response.json() as Promise<TaskPage>;
}
