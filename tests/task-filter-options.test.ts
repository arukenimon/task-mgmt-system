import { describe, expect, it } from "vitest";
import { parseTaskFilterOptionPageRequest } from "@/features/tasks/controllers/task-filter-options.controller";

describe("task filter option requests", () => {
  it("validates a searchable cursor page request", () => {
    expect(parseTaskFilterOptionPageRequest(new URLSearchParams({
      kind: "assignee",
      q: "liam",
      cursorLabel: "Liam Chen",
      cursorId: "20000000-0000-0000-0000-000000000005",
    }))).toEqual({
      kind: "assignee",
      query: "liam",
      cursor: { label: "Liam Chen", id: "20000000-0000-0000-0000-000000000005" },
    });
  });

  it("rejects incomplete cursors and unknown option kinds", () => {
    expect(() => parseTaskFilterOptionPageRequest(new URLSearchParams({ kind: "client", cursorLabel: "Atlas" }))).toThrow("The filter option request is invalid.");
    expect(() => parseTaskFilterOptionPageRequest(new URLSearchParams({ kind: "status" }))).toThrow("The filter option request is invalid.");
  });
});
