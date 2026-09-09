import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn() } }));

import { sendEmail } from "@/features/notifications/services/email.service";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllGlobals();
});

describe("email service", () => {
  it("sends Brevo transactional email with the configured sender and workspace link", async () => {
    process.env.EMAIL_PROVIDER = "brevo";
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.EMAIL_FROM = "Bespoke <tasks@example.com>";
    process.env.NEXT_PUBLIC_SITE_URL = "https://tasks.example.com";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messageId: "brevo-id" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    await sendEmail({ to: "member@example.com", subject: "Task assigned", html: "<h1>Assigned</h1>" });

    expect(fetchMock).toHaveBeenCalledWith("https://api.brevo.com/v3/smtp/email", expect.objectContaining({
      method: "POST",
      headers: expect.objectContaining({ "api-key": "test-brevo-key", "content-type": "application/json" }),
    }));
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(request.body as string)).toEqual({
      sender: { email: "tasks@example.com", name: "Bespoke" },
      to: [{ email: "member@example.com" }],
      subject: "Task assigned",
      htmlContent: "<h1>Assigned</h1><p><a href=\"https://tasks.example.com\">Open Bespoke</a></p>",
    });
  });

  it("fails clearly when Brevo is selected without a server-only key", async () => {
    process.env.EMAIL_PROVIDER = "brevo";
    delete process.env.BREVO_API_KEY;

    await expect(sendEmail({ to: "member@example.com", subject: "Subject", html: "<p>Body</p>" }))
      .rejects.toThrow("BREVO_API_KEY is required");
  });

  it("surfaces Brevo provider failures for outbox retry handling", async () => {
    process.env.EMAIL_PROVIDER = "brevo";
    process.env.BREVO_API_KEY = "test-brevo-key";
    process.env.EMAIL_FROM = "tasks@example.com";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Sender is not verified" }), { status: 400, statusText: "Bad Request" })));

    await expect(sendEmail({ to: "member@example.com", subject: "Subject", html: "<p>Body</p>" }))
      .rejects.toThrow("Brevo email send failed (400): Sender is not verified");
  });
});
