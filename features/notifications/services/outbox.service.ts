import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { londonDateParts } from "@/features/notifications/models/digest";
import { sendEmail } from "@/features/notifications/services/email.service";

type DigestTask = {
  title: string;
  due_date: string;
  task_assignees: Array<{
    profile_id: string;
    profiles: { email: string; full_name: string } | { email: string; full_name: string }[] | null;
  }>;
};
type OutboxItem = { id: string; recipient: string; subject: string; html: string; attempts: number };

export async function queueDailyDigests() {
  const admin = createAdminClient();
  const { date } = londonDateParts();
  const { data, error } = await admin
    .from("tasks")
    .select("title,due_date,task_assignees!inner(profile_id,profiles!task_assignees_profile_id_fkey(email,full_name))")
    .neq("status", "complete")
    .lte("due_date", date);
  if (error) throw new Error("Unable to prepare the daily digest.");

  const byOwner = new Map<string, { profile: { email: string; full_name: string }; tasks: DigestTask[] }>();
  for (const task of (data ?? []) as unknown as DigestTask[]) {
    for (const assignee of task.task_assignees) {
      const profile = Array.isArray(assignee.profiles) ? assignee.profiles[0] : assignee.profiles;
      if (profile) byOwner.set(assignee.profile_id, { profile, tasks: [...(byOwner.get(assignee.profile_id)?.tasks ?? []), task] });
    }
  }
  const rows = [...byOwner.entries()].flatMap(([ownerId, entry]) => {
    const lines = entry.tasks.map((task) => `<li><strong>${task.title}</strong> — due ${task.due_date}</li>`).join("");
    return [{ dedupe_key: `daily-digest:${ownerId}:${date}`, recipient: entry.profile.email, subject: `Bespoke: ${entry.tasks.length} deadline reminder${entry.tasks.length === 1 ? "" : "s"}`, html: `<h1>Today’s task reminder</h1><p>Hello ${entry.profile.full_name},</p><ul>${lines}</ul>` }];
  });
  if (!rows.length) return 0;
  const { error: insertError } = await admin.from("email_outbox").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (insertError) throw new Error("Unable to queue the daily digest.");
  return rows.length;
}

export async function flushOutbox(limit = 50) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("email_outbox").select("id,recipient,subject,html,attempts").eq("delivery_status", "pending").lte("send_after", new Date().toISOString()).order("created_at", { ascending: true }).limit(limit);
  if (error) throw new Error("Unable to read the email outbox.");
  let sent = 0;
  for (const item of (data ?? []) as OutboxItem[]) {
    try {
      await sendEmail({ to: item.recipient, subject: item.subject, html: item.html });
      await admin.from("email_outbox").update({ delivery_status: "sent", sent_at: new Date().toISOString(), attempts: item.attempts + 1, last_error: null }).eq("id", item.id);
      sent += 1;
    } catch (error) {
      const attempts = item.attempts + 1;
      await admin.from("email_outbox").update({ delivery_status: attempts >= 3 ? "failed" : "pending", attempts, last_error: error instanceof Error ? error.message : "Unknown delivery failure" }).eq("id", item.id);
    }
  }
  return sent;
}
