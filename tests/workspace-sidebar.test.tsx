import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceSidebar } from "@/features/navigation/views/workspace-sidebar";

describe("workspace sidebar", () => {
  it("shows task navigation as active and hides team management from members", () => {
    render(<WorkspaceSidebar active="board" showTeamManagement={false} teamName="North Team" />);

    const tasksLink = screen.getByRole("link", { name: "Tasks" });
    expect(tasksLink.classList.contains("nav-item-active")).toBe(true);
    expect(screen.queryByRole("link", { name: "Team management" })).toBeNull();
    expect(screen.getByText("North Team")).toBeTruthy();
  });

  it("shows the management destination only for authorized workspaces", () => {
    render(<WorkspaceSidebar active="team" showTeamManagement links={{ team: "/team?scope=all" }} />);

    const managementLink = screen.getByRole("link", { name: "Team management" });
    expect(managementLink.getAttribute("href")).toBe("/team?scope=all");
    expect(managementLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: "Client management" }).getAttribute("href")).toBe("/clients");
  });
});
