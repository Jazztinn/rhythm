import { clearOAuthCookie, readOAuthCookie } from "@/lib/integrations/oauth-cookies";
import { constantTimeEqual } from "@/lib/integrations/oauth";
import { exchangeGoogleCode } from "@/lib/integrations/google";
import { redirectUri } from "@/lib/integrations/config";
import { writeProviderSession } from "@/lib/integrations/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? undefined;
  const oauth = await readOAuthCookie("google");
  await clearOAuthCookie("google");
  if (!oauth || !constantTimeEqual(state, oauth.state)) return NextResponse.redirect(new URL("/settings?integration=google&status=permission_denied", request.url));
  const code = url.searchParams.get("code");
  if (!code || !oauth.verifier) return NextResponse.redirect(new URL("/settings?integration=google&status=provider_unavailable", request.url));
  const result = await exchangeGoogleCode(code, oauth.verifier, redirectUri("google"));
  if (result.data) await writeProviderSession("google", result.data);
  return NextResponse.redirect(new URL(`/settings?integration=google&status=${result.status}`, request.url));
}
