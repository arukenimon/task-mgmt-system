import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { beginWorkspaceNavigation } from "@/features/navigation/models/workspace-navigation";
import { WorkspaceMainLoading } from "@/features/navigation/views/workspace-main-loading";
import { WorkspaceSidebar } from "@/features/navigation/views/workspace-sidebar";

describe("workspace sidebar", () => {
  it("shows task navigation as active and hides team management from members", () => {
    render(<WorkspaceSidebar active="board" showTeamManagement={false} teamName="North Team" />);

    const tasksLink = screen.getByRole("link", { name: "Tasks" });
    expect(tasksLink.classList.contains("nav-item-active")).toBe(true);
    expect(screen.queryByRole("link", { name: "Team management" })).toBeNull();
    expect(screen.getByText("North Team")).toBeTruthy();
    expect(screen.queryByText("Your team")).toBeNull();
  });

  it("shows the management destination only for authorized workspaces", () => {
    render(<WorkspaceSidebar active="team" showTeamManagement links={{ team: "/team?scope=all" }} />);

    const managementLink = screen.getByRole("link", { name: "Team management" });
    expect(managementLink.getAttribute("href")).toBe("/team?scope=all");
    expect(managementLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Client management" }).getAttribute("href")).toBe("/clients");
    expect(document.querySelector(".sidebar-team")).toBeNull();
  });

  it("highlights the selected sidebar destination before the route finishes loading", () => {
    const { rerender } = render(<WorkspaceSidebar active="overview" showTeamManagement={false} />);

    act(() => beginWorkspaceNavigation("list"));

    expect(screen.getByRole("link", { name: "Tasks" }).classList.contains("nav-item-active")).toBe(true);
    expect(screen.getByRole("link", { name: "Overview" }).classList.contains("nav-item-active")).toBe(false);

    rerender(<WorkspaceSidebar active="list" showTeamManagement={false} />);
    expect(screen.getByRole("link", { name: "Tasks" }).getAttribute("aria-current")).toBeNull();
  });

  it("clears the loading state when Tasks returns to Kanban", () => {
    const props = { links: { list: "/kanban?owner=all" }, showTeamManagement: false, taskDestination: "board" as const };
    const { rerender } = render(<><WorkspaceSidebar {...props} active="overview" /><WorkspaceMainLoading active="overview" /></>);

    fireEvent.click(screen.getByRole("link", { name: "Tasks" }));
    expect(screen.getByText("Loading Kanban board")).toBeTruthy();

    rerender(<><WorkspaceSidebar {...props} active="board" /><WorkspaceMainLoading active="board" /></>);
    expect(screen.queryByText("Loading Kanban board")).toBeNull();
  });
});
