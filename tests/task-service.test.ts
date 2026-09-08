import { describe, expect, it } from "vitest";
import {
  canAllocate,
  canChangeStatus,
  validateStatus,
  validateTaskAttachments,
  validateTaskId,
  validateTaskInput,
  validateTaskUpdateInput,
} from "@/features/tasks/services/task.service";
import { MAX_TASK_ATTACHMENT_BYTES, MAX_TASK_ATTACHMENTS } from "@/features/tasks/models/task-attachment";

const ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

describe("task service", () => {
  it("normalizes valid task input and rejects incomplete allocations", () => {
    expect(validateTaskInput({
      title: "  Confirm campaign scope  ",
      clientId: ID,
      assigneeIds: [ID],
      priority: "high",
      dueDate: "2026-10-01",
    })).toEqual({
      title: "Confirm campaign scope",
      description: "",
      clientId: ID,
      assigneeIds: [ID],
      priority: "high",
      dueDate: "2026-10-01",
    });

    expect(() => validateTaskInput({
      title: "Unallocated task",
      clientId: ID,
      assigneeIds: [],
      priority: "medium",
      dueDate: "2026-10-01",
    })).toThrow("Select at least one assignee.");
  });

  it("allows only managers to allocate work and assignees to change their own status", () => {
    expect(canAllocate("senior_director")).toBe(true);
    expect(canAllocate("account_director")).toBe(true);
    expect(canAllocate("team_member")).toBe(false);

    expect(canChangeStatus("team_member", "member-1", ["member-1"])).toBe(true);
    expect(canChangeStatus("team_member", "outsider", ["member-1"])).toBe(false);
    expect(canChangeStatus("account_director", "outsider", [])).toBe(true);
  });

  it("validates task identifiers and statuses", () => {
    expect(validateTaskId(ID)).toBe(ID);
    expect(validateStatus("blocked")).toBe("blocked");
    expect(() => validateStatus("cancelled")).toThrow();
  });

  it("normalizes an edit request and requires the task identifier", () => {
    expect(validateTaskUpdateInput({
      taskId: ID,
      title: "  Revise campaign scope  ",
      description: "  Confirm the milestones.  ",
      clientId: ID,
      assigneeIds: [ID],
      priority: "urgent",
      dueDate: "2026-10-02",
    })).toEqual({
      taskId: ID,
      title: "Revise campaign scope",
      description: "Confirm the milestones.",
      clientId: ID,
      assigneeIds: [ID],
      priority: "urgent",
      dueDate: "2026-10-02",
    });

    expect(() => validateTaskUpdateInput({
      title: "Missing task reference",
      clientId: ID,
      assigneeIds: [ID],
      priority: "medium",
      dueDate: "2026-10-02",
    })).toThrow();
  });

  it("accepts supported image attachments and rejects unsafe uploads", () => {
    const image = new File(["image"], "proof.png", { type: "image/png" });
    expect(validateTaskAttachments(["", image])).toEqual([image]);

    const unsupportedFile = new File(["document"], "brief.pdf", { type: "application/pdf" });
    expect(() => validateTaskAttachments([unsupportedFile])).toThrow("PNG, JPEG, or WebP");

    const oversizedFile = new File([new Uint8Array(MAX_TASK_ATTACHMENT_BYTES + 1)], "large.png", { type: "image/png" });
    expect(() => validateTaskAttachments([oversizedFile])).toThrow("5 MB or smaller");

    const tooManyFiles = Array.from(
      { length: MAX_TASK_ATTACHMENTS + 1 },
      (_, index) => new File(["image"], `proof-${index}.png`, { type: "image/png" }),
    );
    expect(() => validateTaskAttachments(tooManyFiles)).toThrow(`at most ${MAX_TASK_ATTACHMENTS}`);
  });
});
