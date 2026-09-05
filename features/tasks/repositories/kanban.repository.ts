import "server-only";

import { createClient } from "@/lib/supabase/server";
import { KANBAN_PAGE_SIZE, type KanbanTaskPage, type KanbanTaskPageRequest } from "@/features/tasks/models/kanban";
import { TASK_PRIORITIES, TASK_STATUSES, type Task } from "@/features/tasks/models/task";
import { todayKey } from "@/features/tasks/models/task-filters";

const taskFields = "id,title,description,client_id,team_id,owner_id,created_by_id,status,priority,due_date,completed_at,created_at";

function asTask(task: {
  id: string; title: string; description: string; client_id: string; team_id: string; owner_id: string; created_by_id: string;
  status: string; priority: string; due_date: string; completed_at: string | null; created_at: string;
}): Task {
  if (!TASK_STATUSES.includes(task.status as Task["status"]) || !TASK_PRIORITIES.includes(task.priority as Task["priority"])) {
    throw new Error("Task contains invalid workflow data.");
  }

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    clientId: task.client_id,
    teamId: task.team_id,
    ownerId: task.owner_id,
    createdById: task.created_by_id,
    status: task.status as Task["status"],
    priority: task.priority as Task["priority"],
    dueDate: task.due_date,
    completedAt: task.completed_at,
    createdAt: task.created_at,
  };
}

function escapeIlike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&").replace(/"/g, "\\\"");
}

export async function loadKanbanTaskPage({ status, filters, cursor = null }: KanbanTaskPageRequest): Promise<KanbanTaskPage> {
  if (filters.status !== "all" && filters.status !== status) return { tasks: [], total: 0, nextCursor: null };

  const supabase = await createClient();
  let query = supabase.from("tasks").select(taskFields, { count: "exact" }).eq("status", status);

  if (filters.clientId !== "all") query = query.eq("client_id", filters.clientId);
  if (filters.teamId !== "all") query = query.eq("team_id", filters.teamId);
  if (filters.ownerId !== "all") query = query.eq("owner_id", filters.ownerId);
  if (filters.priority !== "all") query = query.eq("priority", filters.priority);

  const today = todayKey();
  if (filters.due === "overdue") query = query.neq("status", "complete").lt("due_date", today);
  if (filters.due === "today") query = query.eq("due_date", today);
  if (filters.due === "week") {
    const weekEnd = new Date(`${today}T12:00:00Z`);
    weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);
    query = query.gte("due_date", today).lte("due_date", weekEnd.toISOString().slice(0, 10));
  }
  const searchFilter = filters.query
    ? `title.ilike."%${escapeIlike(filters.query)}%",description.ilike."%${escapeIlike(filters.query)}%"`
    : null;
  const cursorFilter = cursor
    ? `due_date.gt.${cursor.dueDate},and(due_date.eq.${cursor.dueDate},id.gt.${cursor.id})`
    : null;
  if (searchFilter && cursorFilter) query = query.or(`and(or(${searchFilter}),or(${cursorFilter}))`);
  else if (searchFilter ?? cursorFilter) query = query.or(searchFilter ?? cursorFilter ?? "");

  const { data, error, count } = await query.order("due_date", { ascending: true }).order("id", { ascending: true }).limit(KANBAN_PAGE_SIZE + 1);
  if (error) throw new Error("Unable to load Kanban tasks.");

  const tasks = (data ?? []).slice(0, KANBAN_PAGE_SIZE).map(asTask);
  const hasMore = (data?.length ?? 0) > KANBAN_PAGE_SIZE;
  const lastTask = tasks.at(-1);

  return {
    tasks,
    total: count ?? 0,
    nextCursor: hasMore && lastTask ? { dueDate: lastTask.dueDate, id: lastTask.id } : null,
  };
}
