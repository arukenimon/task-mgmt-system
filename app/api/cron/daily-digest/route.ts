import { isLondonDigestTime } from "@/features/notifications/models/digest";
import { flushOutbox, queueDailyDigests } from "@/features/notifications/services/outbox.service";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!isLondonDigestTime()) return Response.json({ skipped: true, reason: "Outside the 09:00 Europe/London digest window." });

  const queued = await queueDailyDigests();
  const sent = await flushOutbox();
  return Response.json({ queued, sent });
}
