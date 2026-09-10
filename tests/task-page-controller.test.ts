import { describe, expect, it } from "vitest";
import { parseTaskPageRequest } from "@/features/tasks/controllers/task-page.controller";

const clientId = "10000000-0000-0000-0000-000000000001";
const ownerId = "20000000-0000-0000-0000-000000000002";
const cursorId = "30000000-0000-0000-0000-000000000003";

describe("task page requests", () => {
  it("parses a bounded, cursor-paginated task request", () => {
    expect(parseTaskPageRequest(new URLSearchParams({
      client: clientId,
      owner: ownerId,
      status: "in_progress",
      q: "delivery plan",
      cursorDueDate: "2026-09-10",
      cursorId,
      pageSize: "25",
    }))).toEqual({
      filters: {
        clientId,
        teamId: "all",
        ownerId,
        status: "in_progress",
        priority: "all",
        due: "all",
        query: "delivery plan",
      },
      cursor: { dueDate: "2026-09-10", id: cursorId },
      dateRange: null,
      pageSize: 25,
    });
  });

  it("supports calendar date ranges and rejects incomplete cursors", () => {
    expect(parseTaskPageRequest(new URLSearchParams({ startDate: "2026-09-01", endDate: "2026-09-30", pageSize: "100" }))).toMatchObject({
      dateRange: { startDate: "2026-09-01", endDate: "2026-09-30" },
      pageSize: 100,
    });
    expect(() => parseTaskPageRequest(new URLSearchParams({ cursorDueDate: "2026-09-10" }))).toThrow("The task page request is invalid.");
  });
});
