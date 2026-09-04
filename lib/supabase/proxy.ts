import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { hasSupabaseConfig, getSupabaseConfig } from "./env";

const PROTECTED_ROUTE_PREFIXES = [
  "/overview",
  "/list",
  "/calendar",
  "/kanban",
  "/team",
  "/profile",
] as const;

const PUBLIC_AUTH_ROUTES = new Set(["/login", "/auth/confirm"]);

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
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const isSignedIn = !claimsError && typeof claimsData?.claims?.sub === "string";

  if (!isSignedIn && protectedRoute) return redirectWithSessionCookies("/login", request, response);
  if (isSignedIn && pathname === "/login") return redirectWithSessionCookies("/overview", request, response);

  if (protectedRoute) response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function redirectWithSessionCookies(path: string, request: NextRequest, sessionResponse: NextResponse) {
  const response = NextResponse.redirect(new URL(path, request.url));
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
