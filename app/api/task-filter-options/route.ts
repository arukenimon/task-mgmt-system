import { parseTaskFilterOptionPageRequest } from "@/features/tasks/controllers/task-filter-options.controller";
import { getAuthenticatedProfile } from "@/features/tasks/repositories/task.repository";
import { searchTaskFilterOptions } from "@/features/tasks/services/task-filter-options.service";

export async function GET(request: Request) {
  try {
    await getAuthenticatedProfile();
    return Response.json(await searchTaskFilterOptions(parseTaskFilterOptionPageRequest(new URL(request.url).searchParams)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to search filter options.";
    const status = message === "The filter option request is invalid." ? 400 : message === "You must be signed in with an assigned Bespoke profile." ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
