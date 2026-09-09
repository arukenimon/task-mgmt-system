import { parseInAppNotificationPageRequest } from "@/features/notifications/controllers/in-app-notification.controller";
import { getAuthenticatedProfile } from "@/features/tasks/repositories/task.repository";
import { getInAppNotificationPage } from "@/features/notifications/services/in-app-notification.service";

export async function GET(request: Request) {
  try {
    await getAuthenticatedProfile();
    return Response.json(await getInAppNotificationPage(parseInAppNotificationPageRequest(new URL(request.url).searchParams)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Notifications could not be loaded.";
    const status = message === "The notification request is invalid." ? 400 : message === "You must be signed in with an assigned Bespoke profile." ? 401 : 500;
    return Response.json({ error: message }, { status });
  }
}
