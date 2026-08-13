import { NextResponse } from "next/server";
import { AUTH_COOKIE } from "@/lib/auth";

export function POST(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(AUTH_COOKIE, "", { httpOnly: true, secure: new URL(request.url).protocol === "https:" || process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
