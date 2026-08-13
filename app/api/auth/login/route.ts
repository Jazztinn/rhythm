import { NextResponse } from "next/server";
import { AUTH_COOKIE, SESSION_SECONDS, authConfigured, createSessionToken, safeNextPath, verifyCredentials } from "@/lib/auth";

export async function POST(request: Request) {
  const loginUrl = new URL("/login", request.url);
  if (!authConfigured()) {
    loginUrl.searchParams.set("setup", "1");
    return NextResponse.redirect(loginUrl, 303);
  }

  let form: FormData;
  try { form = await request.formData(); } catch { return NextResponse.redirect(loginUrl, 303); }
  const username = typeof form.get("username") === "string" ? String(form.get("username")).slice(0, 120) : "";
  const password = typeof form.get("password") === "string" ? String(form.get("password")).slice(0, 256) : "";
  const next = safeNextPath(form.get("next"));

  if (!(await verifyCredentials(username, password))) {
    await new Promise((resolve) => setTimeout(resolve, 450));
    loginUrl.searchParams.set("error", "1");
    if (next !== "/") loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(AUTH_COOKIE, await createSessionToken(username), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_SECONDS,
    priority: "high",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
