import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, authConfigured, verifySessionToken } from "@/lib/auth";

const publicPaths = new Set([
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/integrations/google/callback",
  "/api/integrations/slack/callback",
]);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = await verifySessionToken(request.cookies.get(AUTH_COOKIE)?.value);

  if (pathname === "/login" && authenticated) return NextResponse.redirect(new URL("/", request.url));
  if (publicPaths.has(pathname)) return NextResponse.next();

  if (!authConfigured() || !authenticated) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    if (!authConfigured()) login.searchParams.set("setup", "1");
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
