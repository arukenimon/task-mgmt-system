import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  TASK_FILTER_OPTION_PAGE_SIZE,
  type TaskFilterOption,
  type TaskFilterOptionCursor,
  type TaskFilterOptionPage,
  type TaskFilterOptionPageRequest,
} from "@/features/tasks/models/task-filter-options";

function escapeIlike(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&").replace(/"/g, "\\\"");
}

function cursorFilter(column: "full_name" | "name", cursor: TaskFilterOptionCursor | null) {
  if (!cursor) return null;
  const label = escapeIlike(cursor.label);
  return `${column}.gt."${label}",and(${column}.eq."${label}",id.gt.${cursor.id})`;
}

function asPage(rows: TaskFilterOption[]): TaskFilterOptionPage {
  const items = rows.slice(0, TASK_FILTER_OPTION_PAGE_SIZE);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor: rows.length > TASK_FILTER_OPTION_PAGE_SIZE && lastItem ? { label: lastItem.label, id: lastItem.id } : null,
  };
}

export async function loadTaskFilterOptionPage({ kind, query: searchQuery, cursor = null }: TaskFilterOptionPageRequest): Promise<TaskFilterOptionPage> {
  const supabase = await createClient();
  const search = searchQuery.trim();

  if (kind === "assignee") {
    let query = supabase.from("profiles").select("id,full_name").eq("role", "team_member");
    if (search) query = query.ilike("full_name", `%${escapeIlike(search)}%`);
    const after = cursorFilter("full_name", cursor);
    if (after) query = query.or(after);
    const { data, error } = await query.order("full_name").order("id").limit(TASK_FILTER_OPTION_PAGE_SIZE + 1);
    if (error) throw new Error("Unable to search assignees.");
    return asPage((data ?? []).map((person) => ({ id: person.id, label: person.full_name })));
  }

  if (kind === "client") {
    let query = supabase.from("clients").select("id,name");
    if (search) query = query.ilike("name", `%${escapeIlike(search)}%`);
    const after = cursorFilter("name", cursor);
    if (after) query = query.or(after);
    const { data, error } = await query.order("name").order("id").limit(TASK_FILTER_OPTION_PAGE_SIZE + 1);
    if (error) throw new Error("Unable to search clients.");
    return asPage((data ?? []).map((client) => ({ id: client.id, label: client.name })));
  }

  let query = supabase.from("teams").select("id,name");
  if (search) query = query.ilike("name", `%${escapeIlike(search)}%`);
  const after = cursorFilter("name", cursor);
  if (after) query = query.or(after);
  const { data, error } = await query.order("name").order("id").limit(TASK_FILTER_OPTION_PAGE_SIZE + 1);
  if (error) throw new Error("Unable to search teams.");
  return asPage((data ?? []).map((team) => ({ id: team.id, label: team.name })));
}
