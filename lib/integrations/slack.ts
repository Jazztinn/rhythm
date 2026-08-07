import { classifyProviderError, classifyProviderResponse, failure, success, type IntegrationResponse } from "./contracts.ts";
import type { ProviderSession } from "./session.ts";

const SLACK_API = "https://slack.com/api";
type FetchLike = typeof fetch;
export type SlackChannel = { id: string; name: string; isPrivate?: boolean; isMember?: boolean };
export type SlackMessage = { id: string; channelId: string; text: string; user?: string; timestamp: string; permalink?: string };
type SlackApiChannel = { id: string; name: string; is_private?: boolean; is_member?: boolean };

async function slackRequest<T>(token: string, method: string, body: Record<string, string> = {}, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<T>> {
  try {
    const response = await fetchImpl(`${SLACK_API}/${method}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams(body) });
    if (!response.ok) return failure(classifyProviderResponse(response.status), `Slack returned ${response.status}.`, response.status === 429 || response.status >= 500);
    const result = await response.json() as T & { ok?: boolean; error?: string };
    if (result.ok === false) {
      const code = result.error === "invalid_auth" || result.error === "token_revoked" ? "token_expired" : result.error === "missing_scope" ? "permission_denied" : result.error === "ratelimited" ? "rate_limited" : "provider_unavailable";
      return failure(code, `Slack could not complete ${method}.`, code === "rate_limited" || code === "provider_unavailable");
    }
    return success(result);
  } catch (error) {
    const code = classifyProviderError(error);
    return failure(code, code === "offline" ? "Slack is unavailable offline." : "Slack could not be reached.", code === "offline" || code === "provider_unavailable");
  }
}

export function slackAuthorizationUrl(state: string, redirect: string): string {
  const params = new URLSearchParams({ client_id: process.env.SLACK_CLIENT_ID ?? "", redirect_uri: redirect, state, scope: "channels:read,channels:history" });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

export async function exchangeSlackCode(code: string, state: string, redirect: string, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<ProviderSession>> {
  const result = await slackRequest<{ access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; team?: { id?: string } }>("", "oauth.v2.access", { code, state, client_id: process.env.SLACK_CLIENT_ID ?? "", client_secret: process.env.SLACK_CLIENT_SECRET ?? "", redirect_uri: redirect }, fetchImpl);
  if (!result.data?.access_token) return result.error ? result as IntegrationResponse<ProviderSession> : failure("provider_unavailable", "Slack did not return an access token.");
  return success({ accessToken: result.data.access_token, refreshToken: result.data.refresh_token, expiresAt: result.data.expires_in ? Date.now() + result.data.expires_in * 1000 : undefined, scope: result.data.scope, providerUserId: result.data.team?.id });
}

export async function listSlackChannels(token: string, cursor = "", fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<{ channels: SlackChannel[]; nextCursor?: string }>> {
  const result = await slackRequest<{ channels?: SlackApiChannel[]; response_metadata?: { next_cursor?: string } }>(token, "conversations.list", { types: "public_channel", exclude_archived: "true", limit: "200", ...(cursor ? { cursor } : {}) }, fetchImpl);
  return result.data ? success({ channels: (result.data.channels ?? []).filter((channel) => channel.is_private !== true && channel.is_member === true).map((channel) => ({ id: channel.id, name: channel.name, isPrivate: channel.is_private, isMember: channel.is_member })), nextCursor: result.data.response_metadata?.next_cursor || undefined }) : result as unknown as IntegrationResponse<{ channels: SlackChannel[]; nextCursor?: string }>;
}

export async function listSlackMessages(token: string, channelId: string, cursor = "", fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<{ messages: SlackMessage[]; nextCursor?: string }>> {
  const result = await slackRequest<{ messages?: Array<{ ts: string; text?: string; user?: string; permalink?: string }>; response_metadata?: { next_cursor?: string } }>(token, "conversations.history", { channel: channelId, limit: "100", ...(cursor ? { cursor } : {}) }, fetchImpl);
  return result.data ? success({ messages: (result.data.messages ?? []).map((message) => ({ id: `${channelId}:${message.ts}`, channelId, text: message.text ?? "", user: message.user, timestamp: message.ts, permalink: message.permalink })), nextCursor: result.data.response_metadata?.next_cursor || undefined }) : result as unknown as IntegrationResponse<{ messages: SlackMessage[]; nextCursor?: string }>;
}
