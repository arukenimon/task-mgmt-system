import { afterEach, describe, expect, it, vi } from "vitest";

const { afterMock, flushOutboxMock } = vi.hoisted(() => ({
  afterMock: vi.fn(),
  flushOutboxMock: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: afterMock }));
vi.mock("@/features/notifications/services/outbox.service", () => ({ flushOutbox: flushOutboxMock }));

import { dispatchOutboxAfterResponse } from "@/features/notifications/services/delivery-dispatch.service";

afterEach(() => {
  afterMock.mockReset();
  flushOutboxMock.mockReset();
  vi.restoreAllMocks();
});

describe("post-response email dispatch", () => {
  it("does not start delivery until the response callback runs", async () => {
    let callback: (() => Promise<void>) | undefined;
    afterMock.mockImplementation((scheduled) => { callback = scheduled; });
    flushOutboxMock.mockResolvedValue(1);

    dispatchOutboxAfterResponse();

    expect(flushOutboxMock).not.toHaveBeenCalled();
    await callback?.();
    expect(flushOutboxMock).toHaveBeenCalledOnce();
  });

  it("contains outbox delivery failures so a completed task mutation remains successful", async () => {
    let callback: (() => Promise<void>) | undefined;
    afterMock.mockImplementation((scheduled) => { callback = scheduled; });
    flushOutboxMock.mockRejectedValue(new Error("Brevo unavailable"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    dispatchOutboxAfterResponse();

    await expect(callback?.()).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith("Email outbox delivery failed after a task mutation.", expect.any(Error));
  });
});
