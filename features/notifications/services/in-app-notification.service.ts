import type { InAppNotificationPageRequest } from "@/features/notifications/models/in-app-notification";
import { loadInAppNotificationPage, markAllInAppNotificationsRead } from "@/features/notifications/repositories/in-app-notification.repository";

export async function getInAppNotificationPage(request: InAppNotificationPageRequest) {
  return loadInAppNotificationPage(request);
}

export async function markAllNotificationsRead() {
  return markAllInAppNotificationsRead();
}
