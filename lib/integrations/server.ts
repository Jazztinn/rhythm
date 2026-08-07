import { isProviderConfigured } from "./config.ts";
import { failure, type IntegrationProvider, type IntegrationResponse } from "./contracts.ts";
import { refreshGoogleSession } from "./google.ts";
import { refreshSlackSession } from "./slack-server.ts";
import { readProviderSession, writeProviderSession, type ProviderSession } from "./session.ts";

export async function providerAccessToken(provider: IntegrationProvider): Promise<IntegrationResponse<string>> {
  if (!isProviderConfigured(provider)) return failure("not_configured", "This provider is not configured for this Rhythm workspace.");
  const session = await readProviderSession(provider);
  if (!session) return failure("not_connected", "Connect this provider to see its data.");
  if (!session.expiresAt || session.expiresAt > Date.now() + 30_000) return { status: "connected", data: session.accessToken, error: null };
  const refreshed = provider === "google" ? await refreshGoogleSession(session) : await refreshSlackSession(session);
  if (refreshed.data) await writeProviderSession(provider, refreshed.data);
  return refreshed.data ? { status: "connected", data: refreshed.data.accessToken, error: null } : refreshed as unknown as IntegrationResponse<string>;
}

export async function providerConnection(provider: IntegrationProvider): Promise<{ status: IntegrationResponse<null>["status"]; connected: boolean }> {
  if (!isProviderConfigured(provider)) return { status: "not_configured", connected: false };
  const session = await readProviderSession(provider);
  if (!session) return { status: "not_connected", connected: false };
  return { status: session.expiresAt && session.expiresAt <= Date.now() ? "token_expired" : "connected", connected: true };
}

export type { ProviderSession };
