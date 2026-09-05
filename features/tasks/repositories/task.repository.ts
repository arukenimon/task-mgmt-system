import "server-only";

import { getCurrentProfile } from "@/features/identity/repositories/profile.repository";
import { createClient } from "@/lib/supabase/server";
import type { TaskInput } from "@/features/tasks/models/task.schemas";
import type { TaskStatus } from "@/features/tasks/models/task";
import { TASK_ATTACHMENT_BUCKET, type TaskAttachment } from "@/features/tasks/models/task-attachment";

export async function getAuthenticatedProfile() {
  const profile = await getCurrentProfile();
  if (!profile) throw new Error("You must be signed in with an assigned Bespoke profile.");
  return profile;
}

export async function getTask(taskId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("tasks").select("id, team_id, owner_id, status").eq("id", taskId).single();
  if (error || !data) throw new Error("Task not found or not available to this account.");
  return data;
}

export async function insertTask(actorId: string, teamId: string, input: TaskInput) {
  const supabase = await createClient();
  const { data: owner, error: ownerError } = await supabase.from("profiles").select("team_id, role, is_active").eq("id", input.ownerId).single();
  if (ownerError || !owner || owner.role !== "team_member" || owner.team_id !== teamId || !owner.is_active) throw new Error("The owner must be an active member of the selected team.");
  const { data, error } = await supabase.from("tasks").insert({
    title: input.title,
    description: input.description,
    client_id: input.clientId,
    team_id: teamId,
    owner_id: input.ownerId,
    created_by_id: actorId,
    priority: input.priority,
    due_date: input.dueDate,
  }).select("id").single();
  if (error) throw new Error("The task could not be allocated.");
  return data;
}

export async function setTaskStatus(taskId: string, status: TaskStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("tasks").update({ status, completed_at: status === "complete" ? new Date().toISOString() : null }).eq("id", taskId);
  if (error) throw new Error("The task status could not be updated.");
}

export async function uploadTaskAttachments(taskId: string, uploadedBy: string, files: File[]) {
  const supabase = await createClient();
  const uploadedPaths: string[] = [];

  try {
    for (const file of files) {
      const extension = extensionForMimeType(file.type);
      const storagePath = `${taskId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from(TASK_ATTACHMENT_BUCKET).upload(storagePath, await file.arrayBuffer(), {
        contentType: file.type,
        upsert: false,
      });
      if (uploadError) throw new Error("An image could not be uploaded.");

      const { error: attachmentError } = await supabase.from("task_attachments").insert({
        task_id: taskId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        byte_size: file.size,
        uploaded_by: uploadedBy,
      });
      if (attachmentError) {
        await supabase.storage.from(TASK_ATTACHMENT_BUCKET).remove([storagePath]);
        throw new Error("The uploaded image could not be linked to the task.");
      }

      uploadedPaths.push(storagePath);
    }
  } catch (error) {
    if (uploadedPaths.length > 0) {
      await supabase.from("task_attachments").delete().eq("task_id", taskId);
      await supabase.storage.from(TASK_ATTACHMENT_BUCKET).remove(uploadedPaths);
    }
    throw error;
  }
}

export async function getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("task_attachments")
    .select("id,task_id,file_name,mime_type,byte_size,storage_path,created_at")
    .eq("task_id", taskId)
    .order("created_at");
  if (error) throw new Error("Task attachments could not be loaded.");

  return Promise.all((data ?? []).map(async (attachment) => {
    const { data: signedUrl, error: signedUrlError } = await supabase.storage
      .from(TASK_ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.storage_path, 60 * 60);
    if (signedUrlError || !signedUrl?.signedUrl) throw new Error("A task image could not be opened.");

    return {
      id: attachment.id,
      taskId: attachment.task_id,
      fileName: attachment.file_name,
      mimeType: attachment.mime_type as TaskAttachment["mimeType"],
      byteSize: attachment.byte_size,
      url: signedUrl.signedUrl,
      createdAt: attachment.created_at,
    };
  }));
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}
