import type { TaskFilterOptionPage, TaskFilterOptionPageRequest } from "@/features/tasks/models/task-filter-options";
import { loadTaskFilterOptionPage } from "@/features/tasks/repositories/task-filter-options.repository";

export async function searchTaskFilterOptions(request: TaskFilterOptionPageRequest): Promise<TaskFilterOptionPage> {
  return loadTaskFilterOptionPage(request);
}
