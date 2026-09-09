import { z } from "zod";
import type { InAppNotificationPageRequest } from "@/features/notifications/models/in-app-notification";

const requestSchema = z.object({
  cursorCreatedAt: z.iso.datetime({ offset: true }).optional(),
  cursorId: z.guid().optional(),
}).refine((value) => Boolean(value.cursorCreatedAt) === Boolean(value.cursorId), {
  message: "A notification cursor must include both its timestamp and id.",
});

export function parseInAppNotificationPageRequest(params: URLSearchParams): InAppNotificationPageRequest {
  const parsed = requestSchema.safeParse({
    cursorCreatedAt: params.get("cursorCreatedAt") ?? undefined,
    cursorId: params.get("cursorId") ?? undefined,
  });
  if (!parsed.success) throw new Error("The notification request is invalid.");

  return {
    cursor: parsed.data.cursorCreatedAt && parsed.data.cursorId
      ? { createdAt: parsed.data.cursorCreatedAt, id: parsed.data.cursorId }
      : null,
  };
}
