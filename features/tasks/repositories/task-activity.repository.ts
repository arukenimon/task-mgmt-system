import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  TASK_ACTIVITY_EVENT_TYPES,
  TASK_ACTIVITY_PAGE_SIZE,
  type TaskActivity,
  type TaskActivityPage,
  type TaskActivityPageRequest,
} from "@/features/tasks/models/task-activity";

function isTaskActivityEventType(value: string): value is TaskActivity["eventType"] {
  return TASK_ACTIVITY_EVENT_TYPES.includes(value as TaskActivity["eventType"]);
}

export async function loadTaskActivityPage({ taskId, cursor = null }: TaskActivityPageRequest): Promise<TaskActivityPage> {
  const supabase = await createClient();
  let query = supabase
    .from("task_activity")
    .select("id,task_id,actor_id,event_type,summary,metadata,created_at,actor:profiles!task_activity_actor_id_fkey(full_name,initials)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(TASK_ACTIVITY_PAGE_SIZE + 1);

  if (cursor) {
    query = query.or(`created_at.lt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`);
  }

  const { data, error } = await query;
  if (error) throw new Error("Task activity could not be loaded.");

  const rows = data ?? [];
  const items = rows.slice(0, TASK_ACTIVITY_PAGE_SIZE).map((item) => {
    const actor = Array.isArray(item.actor) ? item.actor[0] : item.actor;
    if (!actor || !isTaskActivityEventType(item.event_type)) throw new Error("Task activity contains invalid data.");

    return {
      id: item.id,
      taskId: item.task_id,
      actorId: item.actor_id,
      eventType: item.event_type,
      summary: item.summary,
      metadata: item.metadata as Record<string, unknown>,
      createdAt: item.created_at,
      actor: { name: actor.full_name, initials: actor.initials },
    } satisfies TaskActivity;
  });
  const lastItem = items.at(-1);

  return {
    items,
    nextCursor: rows.length > TASK_ACTIVITY_PAGE_SIZE && lastItem
      ? { createdAt: lastItem.createdAt, id: lastItem.id }
      : null,
  };
}
