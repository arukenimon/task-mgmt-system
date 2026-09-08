import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { hasPasswordAuthentication } from "@/lib/supabase/authentication";
import { hasSupabaseConfig, getSupabaseConfig } from "./env";

const PROTECTED_ROUTE_PREFIXES = [
  "/overview",
  "/list",
  "/calendar",
  "/kanban",
  "/team",
  "/profile",
] as const;

const PUBLIC_AUTH_ROUTES = new Set(["/login", "/forgot-password", "/auth/confirm", "/auth/complete", "/auth/set-password"]);

export function isProtectedRoute(pathname: string) {
  return pathname === "/" || PROTECTED_ROUTE_PREFIXES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isPublicAuthRoute(pathname: string) {
  return PUBLIC_AUTH_ROUTES.has(pathname);
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const protectedRoute = isProtectedRoute(pathname);
  const publicAuthRoute = isPublicAuthRoute(pathname);

  // Older/default Supabase recovery emails redirect to the Site URL with a PKCE
  // code. Preserve that code and send it through the callback instead of losing
  // it when the protected home route redirects to login.
  const legacyAuthCode = pathname === "/" ? request.nextUrl.searchParams.get("code") : null;
  if (legacyAuthCode) {
    const callback = new URL("/auth/confirm", request.url);
    callback.searchParams.set("code", legacyAuthCode);
    callback.searchParams.set("reason", "recovery");
    const flowId = request.nextUrl.searchParams.get("sb_flow_id");
    if (flowId) callback.searchParams.set("sb_flow_id", flowId);
    return NextResponse.redirect(callback);
  }

  if (!protectedRoute && !publicAuthRoute) return NextResponse.next({ request });

  if (!hasSupabaseConfig) {
    return protectedRoute
      ? redirectWithSessionCookies("/login", request, NextResponse.next({ request }))
      : NextResponse.next({ request });
  }

  const { url, key } = getSupabaseConfig();
  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const isSignedIn = !claimsError && typeof claimsData?.claims?.sub === "string";
  const isPasswordSignedIn = isSignedIn && hasPasswordAuthentication(claimsData.claims);

  if (!isPasswordSignedIn && protectedRoute) return redirectWithSessionCookies("/login", request, response);
  if (isPasswordSignedIn && pathname === "/login") return redirectWithSessionCookies("/overview", request, response);

  if (protectedRoute) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectWithSessionCookies(path: string, request: NextRequest, sessionResponse: NextResponse) {
  const response = NextResponse.redirect(new URL(path, request.url));
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
