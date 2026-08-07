import { classifyProviderError, classifyProviderResponse, failure, success, type IntegrationResponse } from "./contracts.ts";
import type { ProviderSession } from "./session.ts";

const SLACK_TOKEN = "https://slack.com/api/oauth.v2.access";

export async function refreshSlackSession(session: ProviderSession, fetchImpl: typeof fetch = fetch): Promise<IntegrationResponse<ProviderSession>> {
  if (!session.refreshToken) return failure("token_expired", "Reconnect Slack to continue.");
  try {
    const response = await fetchImpl(SLACK_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID ?? "", client_secret: process.env.SLACK_CLIENT_SECRET ?? "", refresh_token: session.refreshToken, grant_type: "refresh_token" }) });
    if (!response.ok) return failure(classifyProviderResponse(response.status), "Slack token refresh was not accepted.", response.status >= 500);
    const body = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string };
    if (!body.access_token) return failure("token_expired", "Reconnect Slack to continue.");
    return success({ ...session, accessToken: body.access_token, refreshToken: body.refresh_token ?? session.refreshToken, expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined, scope: body.scope ?? session.scope });
  } catch (error) {
    const code = classifyProviderError(error);
    return failure(code, code === "offline" ? "Slack is unavailable offline." : "Slack could not be reached.", code === "offline" || code === "provider_unavailable");
  }
}
