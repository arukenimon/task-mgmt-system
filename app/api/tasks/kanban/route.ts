import { getAuthenticatedProfile } from "@/features/tasks/repositories/task.repository";
import { parseKanbanTaskPageRequest } from "@/features/tasks/controllers/kanban.controller";
import { loadKanbanTaskPage } from "@/features/tasks/repositories/kanban.repository";

export async function GET(request: Request) {
  const startedAt = performance.now();
  try {
    await getAuthenticatedProfile();
    const page = await loadKanbanTaskPage(parseKanbanTaskPageRequest(new URL(request.url).searchParams));
    if (process.env.NODE_ENV === "production") {
      console.info(JSON.stringify({ level: "info", message: "Kanban task page loaded", route: "/api/tasks/kanban", ms: Math.round(performance.now() - startedAt), rows: page.tasks.length, total: page.total }));
    }
    return Response.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load Kanban tasks.";
    if (process.env.NODE_ENV === "production") {
      console.error(JSON.stringify({ level: "error", message: "Kanban task page failed", route: "/api/tasks/kanban", ms: Math.round(performance.now() - startedAt), error: message }));
    }
    const status = message === "The Kanban page request is invalid." ? 400 : message === "You must be signed in with an assigned Bespoke profile." ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
