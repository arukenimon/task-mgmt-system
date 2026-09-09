import "server-only";

import nodemailer from "nodemailer";
import { getSiteUrl } from "@/lib/supabase/env";

export type EmailMessage = { to: string; subject: string; html: string };

export async function sendEmail(message: EmailMessage) {
  const from = process.env.EMAIL_FROM ?? "Bespoke <tasks@local.test>";
  const html = withWorkspaceLink(message.html);

  if (process.env.EMAIL_PROVIDER === "brevo") {
    await sendWithBrevo({ ...message, html }, from);
    return;
  }
  if (process.env.EMAIL_PROVIDER !== undefined && process.env.EMAIL_PROVIDER !== "smtp") {
    throw new Error("EMAIL_PROVIDER must be either smtp or brevo.");
  }

  const transport = nodemailer.createTransport({
    host: process.env.MAILPIT_HOST ?? "127.0.0.1",
    port: Number(process.env.MAILPIT_PORT ?? 56425),
    secure: false,
  });
  await transport.sendMail({ from, to: message.to, subject: message.subject, html });
}

async function sendWithBrevo(message: EmailMessage, from: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) throw new Error("BREVO_API_KEY is required when EMAIL_PROVIDER=brevo.");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      accept: "application/json",
      "api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender: parseSender(from),
      to: [{ email: message.to }],
      subject: message.subject,
      htmlContent: message.html,
    }),
  });

  if (!response.ok) throw new Error(`Brevo email send failed (${response.status}): ${await responseDetail(response)}`);
}

function parseSender(value: string) {
  const namedAddress = value.match(/^\s*(.*?)\s*<\s*([^<>\s]+@[^<>\s]+)\s*>\s*$/);
  const email = namedAddress ? namedAddress[2] : value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("EMAIL_FROM must contain a valid sender email address.");

  const name = namedAddress?.[1]?.trim().replace(/^"|"$/g, "");
  return name ? { email, name } : { email };
}

function withWorkspaceLink(html: string) {
  const siteUrl = escapeHtml(getSiteUrl());
  return `${html}<p><a href="${siteUrl}">Open Bespoke</a></p>`;
}

async function responseDetail(response: Response) {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === "object" && "message" in body && typeof body.message === "string") return body.message;
  } catch {
    // Brevo can return an empty or non-JSON error response.
  }
  return response.statusText || "Unknown provider error";
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
