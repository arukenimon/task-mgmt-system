import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/auth/confirm",
    "/overview/:path*",
    "/list/:path*",
    "/calendar/:path*",
    "/kanban/:path*",
    "/team/:path*",
    "/profile/:path*",
  ],
};
