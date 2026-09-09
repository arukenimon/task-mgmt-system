import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type DigestTaskRow = {
  title: string;
  due_date: string;
  task_assignees: Array<{
    profile_id: string;
    profiles: { email: string; full_name: string } | { email: string; full_name: string }[] | null;
  }>;
};

export type PendingEmail = {
  id: string;
  recipient: string;
  subject: string;
  html: string;
  attempts: number;
  delivery_lease_id: string;
};

export type OutboxEmailInput = {
  dedupe_key: string;
  recipient: string;
  subject: string;
  html: string;
};

export async function loadDigestTasks(date: string) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tasks")
    .select("title,due_date,task_assignees!inner(profile_id,profiles!task_assignees_profile_id_fkey(email,full_name))")
    .neq("status", "complete")
    .lte("due_date", date);
  if (error) throw new Error("Unable to prepare the daily digest.");
  return (data ?? []) as unknown as DigestTaskRow[];
}

export async function insertOutboxEmails(rows: OutboxEmailInput[]) {
  if (!rows.length) return;
  const admin = createAdminClient();
  const { error } = await admin.from("email_outbox").upsert(rows, { onConflict: "dedupe_key", ignoreDuplicates: true });
  if (error) throw new Error("Unable to queue the daily digest.");
}

export async function claimPendingEmails(limit: number, leaseId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("claim_email_outbox", { p_limit: limit, p_lease_id: leaseId });
  if (error) throw new Error("Unable to claim pending email deliveries.");
  return (data ?? []) as PendingEmail[];
}

export async function markEmailSent(id: string, leaseId: string, attempts: number) {
  return updateClaimedEmail(id, leaseId, {
    delivery_status: "sent",
    sent_at: new Date().toISOString(),
    attempts,
    last_error: null,
    delivery_lease_id: null,
    lease_expires_at: null,
  });
}

export async function requeueEmail(id: string, leaseId: string, attempts: number, lastError: string, sendAfter: string) {
  return updateClaimedEmail(id, leaseId, {
    delivery_status: attempts >= 3 ? "failed" : "pending",
    attempts,
    last_error: lastError.slice(0, 1000),
    send_after: sendAfter,
    delivery_lease_id: null,
    lease_expires_at: null,
  });
}

async function updateClaimedEmail(id: string, leaseId: string, values: Record<string, string | number | null>) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_outbox")
    .update(values)
    .eq("id", id)
    .eq("delivery_lease_id", leaseId)
    .select("id");
  if (error) throw new Error("Unable to update email delivery status.");
  return (data ?? []).length === 1;
}
