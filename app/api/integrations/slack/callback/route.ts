import { clearOAuthCookie, readOAuthCookie } from "@/lib/integrations/oauth-cookies";
import { constantTimeEqual } from "@/lib/integrations/oauth";
import { exchangeSlackCode } from "@/lib/integrations/slack";
import { redirectUri } from "@/lib/integrations/config";
import { writeProviderSession } from "@/lib/integrations/session";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const oauth = await readOAuthCookie("slack");
  await clearOAuthCookie("slack");
  if (!oauth || !constantTimeEqual(url.searchParams.get("state") ?? undefined, oauth.state)) return NextResponse.redirect(new URL("/settings?integration=slack&status=permission_denied", request.url));
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/settings?integration=slack&status=provider_unavailable", request.url));
  const result = await exchangeSlackCode(code, oauth.state, redirectUri("slack"));
  if (result.data) await writeProviderSession("slack", result.data);
  return NextResponse.redirect(new URL(`/settings?integration=slack&status=${result.status}`, request.url));
}
