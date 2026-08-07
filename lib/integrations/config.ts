import type { IntegrationProvider } from "./contracts.ts";

export function isValidCookieSecret(value = process.env.INTEGRATION_COOKIE_SECRET): boolean {
  if (!value || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) return false;
  try { return Buffer.from(value, "base64").byteLength === 32; } catch { return false; }
}

export function isProviderConfigured(provider: IntegrationProvider): boolean {
  if (!isValidCookieSecret()) return false;
  if (provider === "google") return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
  return Boolean(process.env.SLACK_CLIENT_ID && process.env.SLACK_CLIENT_SECRET && process.env.SLACK_REDIRECT_URI);
}

export function redirectUri(provider: IntegrationProvider): string {
  return provider === "google" ? process.env.GOOGLE_REDIRECT_URI ?? "" : process.env.SLACK_REDIRECT_URI ?? "";
}

export function cookieSecret(): string | undefined {
  return process.env.INTEGRATION_COOKIE_SECRET;
}
