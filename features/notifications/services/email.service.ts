import "server-only";

import nodemailer from "nodemailer";
import { Resend } from "resend";

export type EmailMessage = { to: string; subject: string; html: string };

export async function sendEmail(message: EmailMessage) {
  const from = process.env.EMAIL_FROM ?? "Task Hub <tasks@local.test>";
  if (process.env.EMAIL_PROVIDER === "resend") {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) throw new Error("RESEND_API_KEY is required when EMAIL_PROVIDER=resend.");
    const { error } = await new Resend(apiKey).emails.send({ from, to: message.to, subject: message.subject, html: message.html });
    if (error) throw new Error(error.message);
    return;
  }

  const transport = nodemailer.createTransport({
    host: process.env.MAILPIT_HOST ?? "127.0.0.1",
    port: Number(process.env.MAILPIT_PORT ?? 54325),
    secure: false,
  });
  await transport.sendMail({ from, to: message.to, subject: message.subject, html: message.html });
}
