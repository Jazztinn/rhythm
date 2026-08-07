import { isProviderConfigured, redirectUri } from "@/lib/integrations/config";
import { createOAuthState } from "@/lib/integrations/oauth";
import { writeOAuthCookie } from "@/lib/integrations/oauth-cookies";
import { slackAuthorizationUrl } from "@/lib/integrations/slack";
import { failure } from "@/lib/integrations/contracts";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isProviderConfigured("slack")) return NextResponse.json(failure("not_configured", "Slack is not configured."), { status: 503 });
  const state = createOAuthState();
  await writeOAuthCookie("slack", { state, createdAt: Date.now() });
  return NextResponse.redirect(slackAuthorizationUrl(state, redirectUri("slack")));
}
