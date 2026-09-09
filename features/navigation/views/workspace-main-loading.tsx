"use client";

import { useWorkspaceNavigation, type WorkspaceDestination } from "@/features/navigation/models/workspace-navigation";
import { CenteredLoader } from "@/features/tasks/views/centered-loader";

const DESTINATION_LABELS: Record<WorkspaceDestination, string> = {
  overview: "Overview",
  list: "Tasks",
  calendar: "Calendar",
  board: "Kanban board",
  team: "Team management",
  clients: "Client management",
  profile: "Profile",
};

export function WorkspaceMainLoading({ active }: { active: WorkspaceDestination }) {
  const pendingDestination = useWorkspaceNavigation(active);

  if (!pendingDestination) return null;

  return (
    <div className="workspace-main-loading" aria-busy="true">
      <CenteredLoader label={`Loading ${DESTINATION_LABELS[pendingDestination]}`} />
    </div>
  );
}
