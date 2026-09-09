import "server-only";

import { after } from "next/server";
import { flushOutbox } from "@/features/notifications/services/outbox.service";

export function dispatchOutboxAfterResponse() {
  after(async () => {
    try {
      await flushOutbox();
    } catch (error) {
      console.error("Email outbox delivery failed after a task mutation.", error);
    }
  });
}
