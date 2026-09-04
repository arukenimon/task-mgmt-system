import { WorkspacePage, type WorkspaceSearchParams } from "@/app/workspace-page";

export default function ListPage({ searchParams }: { searchParams: Promise<WorkspaceSearchParams> }) {
  return <WorkspacePage searchParams={searchParams} view="list" />;
}
