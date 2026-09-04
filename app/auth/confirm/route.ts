import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Exchanges the one-time hash in the Supabase email template for a cookie session. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const destination = new URL("/overview", request.url);

  if (!tokenHash || type !== "email") {
    return NextResponse.redirect(new URL("/login?error=invalid-link", request.url));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid-link", request.url));
  }

  return NextResponse.redirect(destination);
}
