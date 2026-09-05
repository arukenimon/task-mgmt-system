import { z } from "zod";
import type { ManagedMemberPageRequest } from "@/features/team/models/team-management";

const requestSchema = z.object({
  query: z.string().trim().max(160).default(""),
  cursorName: z.string().min(1).max(160).optional(),
  cursorId: z.string().uuid().optional(),
}).refine((value) => Boolean(value.cursorName) === Boolean(value.cursorId), {
  message: "A directory cursor must include both the member name and id.",
});

export function parseManagedMemberPageRequest(params: URLSearchParams): ManagedMemberPageRequest {
  const parsed = requestSchema.safeParse({
    query: params.get("q") ?? "",
    cursorName: params.get("cursorName") ?? undefined,
    cursorId: params.get("cursorId") ?? undefined,
  });
  if (!parsed.success) throw new Error("The directory page request is invalid.");

  return {
    query: parsed.data.query,
    cursor: parsed.data.cursorName && parsed.data.cursorId ? { name: parsed.data.cursorName, id: parsed.data.cursorId } : null,
  };
}
