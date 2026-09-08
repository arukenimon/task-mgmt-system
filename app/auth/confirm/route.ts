import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/env";

const confirmationDestinations = {
  invite: "/auth/set-password?reason=invite",
  recovery: "/auth/set-password?reason=recovery",
} as const;

type ConfirmationReason = keyof typeof confirmationDestinations;

function isConfirmationReason(value: string | null): value is ConfirmationReason {
  return value === "invite" || value === "recovery";
}

function invalidLinkDestination(request: NextRequest, reason: ConfirmationReason | null) {
  return new URL(
    reason === "recovery" ? "/forgot-password?error=invalid-link" : "/login?error=invalid-link",
    request.url,
  );
}

function fragmentCompletionDestination(request: NextRequest, reason: ConfirmationReason) {
  return new URL(`/auth/complete?reason=${reason}`, request.url);
}

function setPrivateNoStore(response: NextResponse) {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

/** Accepts custom token-hash links, PKCE code links, and default implicit links. */
export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const requestedReason = request.nextUrl.searchParams.get("reason");
  const reason = isConfirmationReason(type)
    ? type
    : isConfirmationReason(requestedReason)
      ? requestedReason
      : null;

  const { url, key } = getSupabaseConfig();
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => supabaseResponse.headers.set(name, value));
      },
    },
  });

  function redirectWithSessionCookies(destination: URL) {
    const response = NextResponse.redirect(destination);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    return setPrivateNoStore(response);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );

    if (error) return setPrivateNoStore(NextResponse.redirect(invalidLinkDestination(request, reason)));

    return redirectWithSessionCookies(new URL(
      confirmationDestinations[reason ?? "recovery"],
      request.url,
    ));
  }

  if (!tokenHash || !isConfirmationReason(type)) {
    // The default implicit flow places access and refresh tokens after '#'. A
    // browser never sends a URL fragment to the server, so forward to a client
    // page that can establish the session without exposing tokens to this route.
    if (reason) {
      return setPrivateNoStore(NextResponse.redirect(fragmentCompletionDestination(request, reason)));
    }
    return setPrivateNoStore(NextResponse.redirect(invalidLinkDestination(request, reason)));
  }
  const destination = confirmationDestinations[type];

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return setPrivateNoStore(NextResponse.redirect(invalidLinkDestination(request, type)));
  }

  return redirectWithSessionCookies(new URL(destination, request.url));
}
