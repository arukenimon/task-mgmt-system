import { resolveTaskFiltersForActor } from "@/features/tasks/models/task-filters";
import { parseTaskPageRequest } from "@/features/tasks/controllers/task-page.controller";
import { loadTaskPage } from "@/features/tasks/repositories/task-page.repository";
import { getAuthenticatedProfile } from "@/features/tasks/repositories/task.repository";

export async function GET(request: Request) {
  const startedAt = performance.now();
  const params = new URL(request.url).searchParams;

  try {
    const [actor, pageRequest] = await Promise.all([
      getAuthenticatedProfile(),
      Promise.resolve(parseTaskPageRequest(params)),
    ]);
    const filters = resolveTaskFiltersForActor(pageRequest.filters, actor, params.has("owner"));
    const page = await loadTaskPage({ ...pageRequest, filters });

    if (process.env.NODE_ENV === "production") {
      console.info(JSON.stringify({ level: "info", message: "task page loaded", route: "/api/tasks", ms: Math.round(performance.now() - startedAt), rows: page.tasks.length }));
    }
    return Response.json(page);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load tasks.";
    if (process.env.NODE_ENV === "production") {
      console.error(JSON.stringify({ level: "error", message: "task page failed", route: "/api/tasks", ms: Math.round(performance.now() - startedAt), error: message }));
    }
    const status = message === "The task page request is invalid." ? 400 : message === "You must be signed in with an assigned Bespoke profile." ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
