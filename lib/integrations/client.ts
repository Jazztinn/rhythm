import { classifyProviderError, providerMessages, type IntegrationProvider, type IntegrationResponse } from "./contracts.ts";

export async function integrationFetch<T>(input: RequestInfo | URL, init?: RequestInit): Promise<IntegrationResponse<T>> {
  try {
    const response = await fetch(input, init);
    const result = await response.json() as IntegrationResponse<T>;
    if (result && typeof result.status === "string" && "error" in result) return result;
    const code = response.ok ? "provider_unavailable" : response.status === 401 ? "token_expired" : "provider_unavailable";
    return { status: code, data: null, error: { code, message: providerMessages[code], retryable: code === "provider_unavailable" } };
  } catch (error) {
    const code = classifyProviderError(error);
    return { status: code, data: null, error: { code, message: providerMessages[code], retryable: code === "offline" || code === "provider_unavailable" } };
  }
}

export function providerLabel(provider: IntegrationProvider): string { return provider === "google" ? "Google Calendar" : "Slack"; }
