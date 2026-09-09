import { afterEach, describe, expect, it, vi } from "vitest";

const { claimPendingEmailsMock, markEmailSentMock, requeueEmailMock, sendEmailMock } = vi.hoisted(() => ({
  claimPendingEmailsMock: vi.fn(),
  markEmailSentMock: vi.fn(),
  requeueEmailMock: vi.fn(),
  sendEmailMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/features/notifications/repositories/outbox.repository", () => ({
  claimPendingEmails: claimPendingEmailsMock,
  insertOutboxEmails: vi.fn(),
  loadDigestTasks: vi.fn(),
  markEmailSent: markEmailSentMock,
  requeueEmail: requeueEmailMock,
}));
vi.mock("@/features/notifications/services/email.service", () => ({ sendEmail: sendEmailMock }));

import { flushOutbox } from "@/features/notifications/services/outbox.service";

const pendingEmail = {
  id: "4fd66e23-40c1-49c3-bf2f-2fbe9716a5f2",
  recipient: "member@example.com",
  subject: "Subject",
  html: "<p>Body</p>",
  attempts: 0,
  delivery_lease_id: "672abf99-68e1-4124-8fdd-96bd335c7d03",
};

afterEach(() => {
  claimPendingEmailsMock.mockReset();
  markEmailSentMock.mockReset();
  requeueEmailMock.mockReset();
  sendEmailMock.mockReset();
});

describe("outbox service", () => {
  it("claims a bounded batch and marks successful deliveries using its lease", async () => {
    claimPendingEmailsMock.mockResolvedValue([pendingEmail]);
    sendEmailMock.mockResolvedValue(undefined);
    markEmailSentMock.mockResolvedValue(true);

    await expect(flushOutbox(500)).resolves.toBe(1);

    expect(claimPendingEmailsMock).toHaveBeenCalledWith(50, expect.any(String));
    expect(sendEmailMock).toHaveBeenCalledWith({ to: pendingEmail.recipient, subject: pendingEmail.subject, html: pendingEmail.html });
    expect(markEmailSentMock).toHaveBeenCalledWith(pendingEmail.id, pendingEmail.delivery_lease_id, 1);
  });

  it("requeues a failed delivery without rejecting the worker", async () => {
    claimPendingEmailsMock.mockResolvedValue([pendingEmail]);
    sendEmailMock.mockRejectedValue(new Error("Brevo unavailable"));
    requeueEmailMock.mockResolvedValue(true);

    await expect(flushOutbox()).resolves.toBe(0);

    expect(requeueEmailMock).toHaveBeenCalledWith(
      pendingEmail.id,
      pendingEmail.delivery_lease_id,
      1,
      "Brevo unavailable",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    );
  });
});
