export const TASK_ATTACHMENT_BUCKET = "task-attachments";
export const TASK_ATTACHMENT_ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export const MAX_TASK_ATTACHMENTS = 4;
export const MAX_TASK_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type TaskAttachment = {
  id: string;
  taskId: string;
  fileName: string;
  mimeType: (typeof TASK_ATTACHMENT_ACCEPTED_TYPES)[number];
  byteSize: number;
  url: string;
  createdAt: string;
};
