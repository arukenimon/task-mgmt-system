import { WorkspacePage, type WorkspaceSearchParams } from "@/app/workspace-page";

export default function KanbanPage({ searchParams }: { searchParams: Promise<WorkspaceSearchParams> }) {
  return <WorkspacePage searchParams={searchParams} view="board" />;
}
