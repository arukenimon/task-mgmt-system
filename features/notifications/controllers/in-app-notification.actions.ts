"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile } from "@/features/tasks/repositories/task.repository";
import { markAllNotificationsRead } from "@/features/notifications/services/in-app-notification.service";

export async function markAllNotificationsReadAction() {
  await getAuthenticatedProfile();
  await markAllNotificationsRead();
  revalidatePath("/");
}
