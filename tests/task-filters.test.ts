import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FILTERS, matchesTaskFilters, todayKey } from "@/features/tasks/models/task-filters";
import type { Task } from "@/features/tasks/models/task";

function dateOffset(days: number) {
  const date = new Date(`${todayKey()}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function task(overrides: Partial<Task>): Task {
  return {
    id: "task-1",
    title: "Prepare report",
    description: "Review the delivery plan",
    clientId: "client-1",
    teamId: "team-1",
    assigneeIds: ["member-1"],
    createdById: "director-1",
    status: "todo",
    priority: "medium",
    dueDate: dateOffset(0),
    completedAt: null,
    createdAt: dateOffset(-2),
    ...overrides,
  };
}

describe("task filters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 6, 12));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("combines client, assignee, status, priority, and text filters", () => {
    const filters = {
      ...DEFAULT_FILTERS,
      clientId: "client-1",
      ownerId: "member-1",
      status: "todo" as const,
      priority: "medium" as const,
      query: "delivery",
    };

    expect(matchesTaskFilters(task({}), filters)).toBe(true);
    expect(matchesTaskFilters(task({ assigneeIds: ["member-2"] }), filters)).toBe(false);
    expect(matchesTaskFilters(task({ description: "Different work" }), filters)).toBe(false);
  });

  it("keeps completed overdue work out of the overdue queue", () => {
    const overdueFilters = { ...DEFAULT_FILTERS, due: "overdue" as const };

    expect(matchesTaskFilters(task({ dueDate: dateOffset(-1), status: "todo" }), overdueFilters)).toBe(true);
    expect(matchesTaskFilters(task({ dueDate: dateOffset(-1), status: "complete" }), overdueFilters)).toBe(false);
    expect(matchesTaskFilters(task({ dueDate: dateOffset(7) }), { ...DEFAULT_FILTERS, due: "week" })).toBe(true);
    expect(matchesTaskFilters(task({ dueDate: dateOffset(8) }), { ...DEFAULT_FILTERS, due: "week" })).toBe(false);
  });
});
