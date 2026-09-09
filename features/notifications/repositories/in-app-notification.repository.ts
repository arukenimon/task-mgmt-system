import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  IN_APP_NOTIFICATION_PAGE_SIZE,
  IN_APP_NOTIFICATION_TYPES,
  type InAppNotification,
  type InAppNotificationPage,
  type InAppNotificationPageRequest,
} from "@/features/notifications/models/in-app-notification";

function isNotificationType(value: string): value is InAppNotification["notificationType"] {
  return IN_APP_NOTIFICATION_TYPES.includes(value as InAppNotification["notificationType"]);
}

export async function loadInAppNotificationPage({ cursor = null }: InAppNotificationPageRequest): Promise<InAppNotificationPage> {
  const supabase = await createClient();
  let pageQuery = supabase
    .from("user_notifications")
    .select("id,task_id,actor_id,notification_type,title,body,is_read,read_at,created_at")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(IN_APP_NOTIFICATION_PAGE_SIZE + 1);

  if (cursor) {
    pageQuery = pageQuery.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const [pageResult, unreadResult] = await Promise.all([
    pageQuery,
    supabase.from("user_notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);
  if (pageResult.error || unreadResult.error) throw new Error("Notifications could not be loaded.");

  const rows = pageResult.data ?? [];
  const items = rows.slice(0, IN_APP_NOTIFICATION_PAGE_SIZE).map((item) => {
    if (!isNotificationType(item.notification_type)) throw new Error("A notification contains invalid data.");
    return {
      id: item.id,
      taskId: item.task_id,
      actorId: item.actor_id,
      notificationType: item.notification_type,
      title: item.title,
      body: item.body,
      isRead: item.is_read,
      readAt: item.read_at,
      createdAt: item.created_at,
    } satisfies InAppNotification;
  });
  const lastItem = items.at(-1);

  return {
    items,
    unreadCount: unreadResult.count ?? 0,
    nextCursor: rows.length > IN_APP_NOTIFICATION_PAGE_SIZE && lastItem
      ? { createdAt: lastItem.createdAt, id: lastItem.id }
      : null,
  };
}

export async function markAllInAppNotificationsRead() {
  const supabase = await createClient();
  const { error } = await supabase
    .from("user_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("is_read", false);
  if (error) throw new Error("Notifications could not be marked as read.");
}
