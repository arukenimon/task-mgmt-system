export const TASK_ACTIVITY_PAGE_SIZE = 20;

export const TASK_ACTIVITY_EVENT_TYPES = [
  "created",
  "assigned",
  "unassigned",
  "updated",
  "status_changed",
  "completed",
] as const;

export type TaskActivityEventType = (typeof TASK_ACTIVITY_EVENT_TYPES)[number];

export type TaskActivityCursor = {
  createdAt: string;
  id: string;
};

export type TaskActivity = {
  id: string;
  taskId: string;
  actorId: string;
  eventType: TaskActivityEventType;
  summary: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  actor: {
    name: string;
    initials: string;
  };
};

export type TaskActivityPage = {
  items: TaskActivity[];
  nextCursor: TaskActivityCursor | null;
};

export type TaskActivityPageRequest = {
  taskId: string;
  cursor?: TaskActivityCursor | null;
};
