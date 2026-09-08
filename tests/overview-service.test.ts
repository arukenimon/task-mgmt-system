import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOverview } from "@/features/reports/services/overview.service";
import { todayKey } from "@/features/tasks/models/task-filters";
import type { Client, Person, Task } from "@/features/tasks/models/task";

function dateOffset(days: number) {
  const date = new Date(`${todayKey()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "Task",
    description: "",
    clientId: "client-1",
    teamId: "team-1",
    assigneeIds: ["owner-1"],
    createdById: "director-1",
    status: "todo",
    priority: "medium",
    dueDate: dateOffset(0),
    completedAt: null,
    createdAt: dateOffset(-2),
    ...overrides,
  };
}

describe("overview service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 6, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("prioritizes overdue work and reports completion, workload, and unassigned risk", () => {
    const tasks = [
      makeTask({ id: "overdue", dueDate: dateOffset(-1) }),
      makeTask({ id: "completed", status: "complete", dueDate: dateOffset(-1), completedAt: dateOffset(-1) }),
      makeTask({ id: "unassigned", clientId: "client-2", assigneeIds: [], dueDate: dateOffset(2) }),
    ];
    const people: Person[] = [
      { id: "owner-1", name: "Alex Morgan", initials: "AM", email: "alex@example.com", role: "account_director", teamId: "team-1", isActive: true },
      { id: "owner-2", name: "Zoe Patel", initials: "ZP", email: "zoe@example.com", role: "team_member", teamId: "team-1", isActive: true },
      { id: "former-owner", name: "Former Owner", initials: "FO", email: "former@example.com", role: "team_member", teamId: "team-1", isActive: false },
    ];
    const clients: Client[] = [
      { id: "client-1", name: "Atlas", accountLeadId: "owner-1", isActive: true },
      { id: "client-2", name: "Helix", accountLeadId: "owner-1", isActive: true },
    ];

    const overview = buildOverview(tasks, people, clients);

    expect(overview).toMatchObject({
      open: 2,
      overdue: 1,
      dueSoon: 1,
      completionRate: 33,
      onTimeRate: 100,
      peakOwnerLoad: 1,
      unassignedOpen: 1,
    });
    expect(overview.byClient.map((row) => row.id)).toEqual(["client-1", "client-2"]);
    expect(overview.byClient[0]).toMatchObject({ total: 2, completed: 1, overdue: 1 });
    expect(overview.byOwner).toEqual([
      expect.objectContaining({ id: "owner-1", open: 1, overdue: 1 }),
      expect.objectContaining({ id: "owner-2", open: 0, isActive: true }),
    ]);
  });
});
