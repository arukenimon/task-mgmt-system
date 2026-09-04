import { WorkspacePage, type WorkspaceSearchParams } from "@/app/workspace-page";

export default function CalendarPage({ searchParams }: { searchParams: Promise<WorkspaceSearchParams> }) {
  return <WorkspacePage searchParams={searchParams} view="calendar" />;
}
