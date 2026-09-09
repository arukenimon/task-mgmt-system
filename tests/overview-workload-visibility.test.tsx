import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskWorkspace } from "@/features/tasks/views/task-workspace";
import type { Client, Person, Task, Team } from "@/features/tasks/models/task";
import { updateTaskAction } from "@/features/tasks/controllers/task.actions";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/features/tasks/controllers/task.actions", () => ({
  createTaskWithAttachmentsAction: vi.fn(),
  getTaskAttachmentsAction: vi.fn().mockResolvedValue([]),
  updateTaskAction: vi.fn(),
  updateTaskStatusAction: vi.fn(),
}));

vi.mock("@/features/tasks/views/paginated-kanban-board", () => ({
  PaginatedKanbanBoard: () => null,
}));

vi.mock("@/features/identity/controllers/auth.actions", () => ({
  signOut: vi.fn(),
}));

vi.mock("@/features/navigation/views/workspace-sidebar", () => ({
  WorkspaceSidebar: ({ links }: { links: Record<string, string> }) => <a href={links.overview}>Overview navigation</a>,
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

const teams: Team[] = [{ id: "team-1", name: "Delivery", accent: "teal" }];
const clients: Client[] = [
  { id: "client-open", name: "Active client", accountLeadId: null, isActive: true },
  { id: "client-done", name: "Delivered client", accountLeadId: null, isActive: true },
];
const people: Person[] = [
  { id: "director", name: "Alex Director", initials: "AD", email: "alex@example.com", role: "senior_director", teamId: null, isActive: true },
  { id: "owner-open", name: "Busy teammate", initials: "BT", email: "busy@example.com", role: "team_member", teamId: "team-1", isActive: true },
  { id: "owner-idle", name: "Available teammate", initials: "AT", email: "available@example.com", role: "team_member", teamId: "team-1", isActive: true },
];
const tasks: Task[] = [
  { id: "task-open", title: "Current work", description: "", clientId: "client-open", teamId: "team-1", assigneeIds: ["owner-open"], createdById: "director", status: "todo", priority: "medium", dueDate: "2026-09-10", completedAt: null, createdAt: "2026-09-01" },
  { id: "task-done", title: "Finished work", description: "", clientId: "client-done", teamId: "team-1", assigneeIds: ["owner-idle"], createdById: "director", status: "complete", priority: "medium", dueDate: "2026-09-01", completedAt: "2026-09-01", createdAt: "2026-08-28" },
];

describe("overview workload visibility", () => {
  it("uses the compact v parameter when returning to the overview", () => {
    render(<TaskWorkspace initialActorId="director" initialTasks={tasks} people={people} clients={clients} teams={teams} initialView="list" />);

    expect(screen.getByRole("link", { name: "Overview navigation" }).getAttribute("href")).toBe("/overview?owner=all&v=list");
  });

  it("defaults members to their own tasks and clears back to that default", () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          { id: "owner-open", label: "Busy teammate" },
          { id: "owner-idle", label: "Available teammate" },
        ],
        nextCursor: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<TaskWorkspace initialActorId="owner-open" initialTasks={tasks} people={people} clients={clients} teams={teams} initialView="overview" />);

    const assigneeFilter = screen.getByRole("button", { name: "Filter by assignee" });
    expect(assigneeFilter.textContent).toContain("Busy teammate (You)");
    expect((screen.getByRole("button", { name: "Clear all filters" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(assigneeFilter);
    return waitFor(() => {
      expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/task-filter-options?kind=assignee&q=");
      fireEvent.click(screen.getByRole("option", { name: "Available teammate" }));
      fireEvent.click(screen.getByRole("button", { name: "Clear all filters" }));
      expect(assigneeFilter.textContent).toContain("Busy teammate (You)");
    });
  });

  it("searches client and team filter options through the paginated endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [], nextCursor: null }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<TaskWorkspace initialActorId="director" initialTasks={tasks} people={people} clients={clients} teams={teams} initialView="overview" />);

    fireEvent.click(screen.getByRole("button", { name: "Filter by client" }));
    await waitFor(() => expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/task-filter-options?kind=client&q="));
    fireEvent.change(screen.getByPlaceholderText("Search all clients"), { target: { value: "atlas" } });
    await waitFor(() => expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/task-filter-options?kind=client&q=atlas"));
    fireEvent.click(screen.getByRole("button", { name: "Filter by team" }));
    await waitFor(() => expect(fetchMock.mock.calls[2]?.[0]).toBe("/api/task-filter-options?kind=team&q="));
  });

  it("loads another assignee page with the Supabase cursor", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "owner-open", label: "Busy teammate" }], nextCursor: { label: "Busy teammate", id: "owner-open" } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{ id: "owner-idle", label: "Available teammate" }], nextCursor: null }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<TaskWorkspace initialActorId="director" initialTasks={tasks} people={people} clients={clients} teams={teams} initialView="overview" />);

    fireEvent.click(screen.getByRole("button", { name: "Filter by assignee" }));
    const loadMore = await screen.findByRole("button", { name: "Load more" });
    fireEvent.click(loadMore);

    await waitFor(() => expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/task-filter-options?kind=assignee&q=&cursorLabel=Busy+teammate&cursorId=owner-open"));
    expect(screen.getByRole("option", { name: "Available teammate" })).toBeTruthy();
  });

  it("starts with active workload and reveals completed or zero-load rows through All", () => {
    render(<TaskWorkspace initialActorId="director" initialTasks={tasks} people={people} clients={clients} teams={teams} initialView="overview" />);

    expect(screen.queryByRole("button", { name: /Delivered client.*All done/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Available teammate.*No open tasks/ })).toBeNull();

    fireEvent.click(within(screen.getByRole("group", { name: "Client delivery visibility" })).getByRole("button", { name: "All" }));
    fireEvent.click(within(screen.getByRole("group", { name: "Capacity visibility" })).getByRole("button", { name: "All" }));

    expect(screen.getByRole("button", { name: /Delivered client.*All done/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Available teammate.*No open tasks/ })).toBeTruthy();
  });

  it("lets managers edit task details from the task drawer", async () => {
    vi.mocked(updateTaskAction).mockResolvedValue(undefined);
    render(<TaskWorkspace initialActorId="director" initialTasks={tasks} people={people} clients={clients} teams={teams} initialView="overview" />);

    fireEvent.click(screen.getByRole("button", { name: /Current work/ }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Edit task" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Edit task" }));
    await waitFor(() => expect(screen.getByLabelText("Task name")).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Task name"), { target: { value: "Revised current work" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(updateTaskAction).toHaveBeenCalledWith({
      taskId: "task-open",
      title: "Revised current work",
      description: "",
      clientId: "client-open",
      assigneeIds: ["owner-open"],
      priority: "medium",
      dueDate: "2026-09-10",
    }));
    expect(screen.getByText("“Revised current work” was updated.")).toBeTruthy();
  });
});
