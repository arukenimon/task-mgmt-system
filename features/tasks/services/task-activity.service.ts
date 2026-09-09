import type { TaskActivityPageRequest } from "@/features/tasks/models/task-activity";
import { loadTaskActivityPage } from "@/features/tasks/repositories/task-activity.repository";

export async function getTaskActivityPage(request: TaskActivityPageRequest) {
  return loadTaskActivityPage(request);
}
