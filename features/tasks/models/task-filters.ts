import type { Task, TaskPriority, TaskStatus } from "./task";

export type DueWindow = "all" | "overdue" | "today" | "week";

export type TaskFilters = {
  clientId: string;
  teamId: string;
  ownerId: string;
  status: "all" | TaskStatus;
  priority: "all" | TaskPriority;
  due: DueWindow;
  query: string;
};

export const DEFAULT_FILTERS: TaskFilters = {
  clientId: "all",
  teamId: "all",
  ownerId: "all",
  status: "all",
  priority: "all",
  due: "all",
  query: "",
};

export function todayKey() {
  const now = new Date();
  now.setHours(12, 0, 0, 0);
  return now.toISOString().slice(0, 10);
}

export function matchesTaskFilters(task: Task, filters: TaskFilters) {
  const query = filters.query.trim().toLowerCase();
  const today = todayKey();
  const inAWeek = new Date(`${today}T12:00:00Z`);
  inAWeek.setUTCDate(inAWeek.getUTCDate() + 7);
  const weekKey = inAWeek.toISOString().slice(0, 10);

  if (filters.clientId !== "all" && task.clientId !== filters.clientId) return false;
  if (filters.teamId !== "all" && task.teamId !== filters.teamId) return false;
  if (filters.ownerId !== "all" && task.ownerId !== filters.ownerId) return false;
  if (filters.status !== "all" && task.status !== filters.status) return false;
  if (filters.priority !== "all" && task.priority !== filters.priority) return false;
  if (query && !`${task.title} ${task.description}`.toLowerCase().includes(query)) return false;

  if (filters.due === "overdue") return task.status !== "complete" && task.dueDate < today;
  if (filters.due === "today") return task.dueDate === today;
  if (filters.due === "week") return task.dueDate >= today && task.dueDate <= weekKey;
  return true;
}
