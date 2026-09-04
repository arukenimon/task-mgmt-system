import { redirect } from "next/navigation";
import type { WorkspaceSearchParams } from "@/app/workspace-page";

type HomeProps = {
  searchParams: Promise<WorkspaceSearchParams>;
};

const LEGACY_VIEW_ROUTES: Record<string, string> = {
  overview: "/overview",
  list: "/list",
  calendar: "/calendar",
  board: "/kanban",
  kanban: "/kanban",
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const legacyView = Array.isArray(params.view) ? params.view[0] : params.view;
  const targetPath = legacyView ? LEGACY_VIEW_ROUTES[legacyView] ?? "/overview" : "/overview";
  const nextParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (key === "view" || value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) nextParams.append(key, item);
  }

  const query = nextParams.toString();
  redirect(`${targetPath}${query ? `?${query}` : ""}`);
}
