import { parseTaskActivityPageRequest } from "@/features/tasks/controllers/task-activity.controller";
import { getAuthenticatedProfile } from "@/features/tasks/repositories/task.repository";
import { getTaskActivityPage } from "@/features/tasks/services/task-activity.service";

export async function GET(request: Request) {
  try {
    await getAuthenticatedProfile();
    return Response.json(await getTaskActivityPage(parseTaskActivityPageRequest(new URL(request.url).searchParams)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Task activity could not be loaded.";
    const status = message === "The activity request is invalid." ? 400 : message === "You must be signed in with an assigned Bespoke profile." ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
