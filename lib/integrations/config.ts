import type { IntegrationProvider } from "./contracts.ts";

export function isProviderConfigured(provider: IntegrationProvider): boolean {
  if (provider === "google") return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SLACK_REDIRECT_URI);
}

export function redirectUri(provider: IntegrationProvider): string {
  return provider === "google" ? process.env.GOOGLE_REDIRECT_URI ?? "" : process.env.SLACK_REDIRECT_URI ?? "";
}

export function cookieSecret(): string | undefined {
  return process.env.INTEGRATION_COOKIE_SECRET;
}
