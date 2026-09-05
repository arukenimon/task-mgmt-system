import { getAuthenticatedProfile } from "@/features/tasks/repositories/task.repository";
import { parseKanbanTaskPageRequest } from "@/features/tasks/controllers/kanban.controller";
import { loadKanbanTaskPage } from "@/features/tasks/repositories/kanban.repository";

export async function GET(request: Request) {
  try {
    await getAuthenticatedProfile();
    const page = await loadKanbanTaskPage(parseKanbanTaskPageRequest(new URL(request.url).searchParams));
    return Response.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Kanban tasks.";
    const status = message === "The Kanban page request is invalid." ? 400 : message === "You must be signed in with an assigned Bespoke profile." ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
