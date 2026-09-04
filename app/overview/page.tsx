import { WorkspacePage, type WorkspaceSearchParams } from "@/app/workspace-page";

export default function OverviewPage({ searchParams }: { searchParams: Promise<WorkspaceSearchParams> }) {
  return <WorkspacePage searchParams={searchParams} view="overview" />;
}
