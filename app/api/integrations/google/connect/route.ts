import { isProviderConfigured, redirectUri } from "@/lib/integrations/config";
import { createOAuthState, createPkceChallenge, createPkceVerifier } from "@/lib/integrations/oauth";
import { writeOAuthCookie } from "@/lib/integrations/oauth-cookies";
import { googleAuthorizationUrl } from "@/lib/integrations/google";
import { failure } from "@/lib/integrations/contracts";
import { NextResponse } from "next/server";

export async function GET() {
  if (!isProviderConfigured("google")) return NextResponse.json(failure("not_configured", "Google Calendar is not configured."), { status: 503 });
  const state = createOAuthState();
  const verifier = createPkceVerifier();
  await writeOAuthCookie("google", { state, verifier, createdAt: Date.now() });
  return NextResponse.redirect(googleAuthorizationUrl(state, createPkceChallenge(verifier), redirectUri("google")));
}
