import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { parseManagedMemberPageRequest } from "@/features/team/controllers/team-directory.controller";
import { loadManagedMemberPage } from "@/features/team/repositories/team-management.repository";

export async function GET(request: Request) {
  try {
    const profile = await getCurrentProfile();
    if (!profile) return Response.json({ error: "Sign in to view the team directory." }, { status: 401 });
    if (profile.role !== "senior_director") return Response.json({ error: "Only Senior Directors can view the team directory." }, { status: 403 });
    return Response.json(await loadManagedMemberPage(parseManagedMemberPageRequest(new URL(request.url).searchParams)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the team directory.";
    const status = message === "The directory page request is invalid." ? 400 : 500;
    return Response.json({ error: message }, { status });
  }
}
