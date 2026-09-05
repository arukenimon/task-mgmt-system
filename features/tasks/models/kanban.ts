import type { Task, TaskStatus } from "./task";
import type { TaskFilters } from "./task-filters";

export const KANBAN_PAGE_SIZE = 20;

export type KanbanCursor = {
  dueDate: string;
  id: string;
};

export type KanbanTaskPage = {
  tasks: Task[];
  nextCursor: KanbanCursor | null;
  total: number;
};

export type KanbanTaskPageRequest = {
  status: TaskStatus;
  filters: TaskFilters;
  cursor?: KanbanCursor | null;
};

export type InitialKanbanPages = Record<TaskStatus, KanbanTaskPage>;
