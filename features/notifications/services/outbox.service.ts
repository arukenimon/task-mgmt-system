import "server-only";

import { londonDateParts } from "@/features/notifications/models/digest";
import { sendEmail } from "@/features/notifications/services/email.service";
import {
  claimPendingEmails,
  insertOutboxEmails,
  loadDigestTasks,
  markEmailSent,
  requeueEmail,
  type DigestTaskRow,
} from "@/features/notifications/repositories/outbox.repository";

export async function queueDailyDigests() {
  const { date } = londonDateParts();
  const tasks = await loadDigestTasks(date);

  const byOwner = new Map<string, { profile: { email: string; full_name: string }; tasks: DigestTaskRow[] }>();
  for (const task of tasks) {
    for (const assignee of task.task_assignees) {
      const profile = Array.isArray(assignee.profiles) ? assignee.profiles[0] : assignee.profiles;
      if (profile) byOwner.set(assignee.profile_id, { profile, tasks: [...(byOwner.get(assignee.profile_id)?.tasks ?? []), task] });
    }
  }
  const rows = [...byOwner.entries()].flatMap(([ownerId, entry]) => {
    const lines = entry.tasks.map((task) => `<li><strong>${escapeHtml(task.title)}</strong> — due ${escapeHtml(task.due_date)}</li>`).join("");
    return [{ dedupe_key: `daily-digest:${ownerId}:${date}`, recipient: entry.profile.email, subject: `Bespoke: ${entry.tasks.length} deadline reminder${entry.tasks.length === 1 ? "" : "s"}`, html: `<h1>Today’s task reminder</h1><p>Hello ${escapeHtml(entry.profile.full_name)},</p><ul>${lines}</ul>` }];
  });
  if (!rows.length) return 0;
  await insertOutboxEmails(rows);
  return rows.length;
}

export async function flushOutbox(limit = 50) {
  const boundedLimit = Math.min(50, Math.max(1, Math.floor(limit)));
  const pendingEmails = await claimPendingEmails(boundedLimit, crypto.randomUUID());
  let sent = 0;
  for (const item of pendingEmails) {
    try {
      await sendEmail({ to: item.recipient, subject: item.subject, html: item.html });
      if (await markEmailSent(item.id, item.delivery_lease_id, item.attempts + 1)) sent += 1;
    } catch (error) {
      const attempts = item.attempts + 1;
      await requeueEmail(
        item.id,
        item.delivery_lease_id,
        attempts,
        error instanceof Error ? error.message : "Unknown delivery failure",
        retryAt(attempts),
      );
    }
  }
  return sent;
}

function retryAt(attempts: number) {
  const delayMinutes = attempts === 1 ? 5 : 15;
  return new Date(Date.now() + delayMinutes * 60_000).toISOString();
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
