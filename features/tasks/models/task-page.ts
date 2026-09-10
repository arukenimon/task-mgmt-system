import type { Task } from "./task";
import type { TaskFilters } from "./task-filters";

export const TASK_LIST_PAGE_SIZE = 25;
export const TASK_CALENDAR_PAGE_SIZE = 100;

export type TaskCursor = {
  dueDate: string;
  id: string;
};

export type TaskDateRange = {
  startDate: string;
  endDate: string;
};

export type TaskPage = {
  tasks: Task[];
  nextCursor: TaskCursor | null;
};

export type TaskPageRequest = {
  filters: TaskFilters;
  cursor?: TaskCursor | null;
  pageSize?: number;
  dateRange?: TaskDateRange | null;
};
