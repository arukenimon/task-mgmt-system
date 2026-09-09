export const IN_APP_NOTIFICATION_PAGE_SIZE = 20;

export const IN_APP_NOTIFICATION_TYPES = [
  "task_assigned",
  "task_unassigned",
  "task_updated",
  "task_status_changed",
  "task_completed",
] as const;

export type InAppNotificationType = (typeof IN_APP_NOTIFICATION_TYPES)[number];

export type InAppNotificationCursor = {
  createdAt: string;
  id: string;
};

export type InAppNotification = {
  id: string;
  taskId: string;
  actorId: string;
  notificationType: InAppNotificationType;
  title: string;
  body: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};

export type InAppNotificationPage = {
  items: InAppNotification[];
  nextCursor: InAppNotificationCursor | null;
  unreadCount: number;
};

export type InAppNotificationPageRequest = {
  cursor?: InAppNotificationCursor | null;
};
