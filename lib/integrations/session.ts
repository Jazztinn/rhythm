import { cookies } from "next/headers";
import { cookieSecret } from "./config.ts";
import { decryptCookiePayload, encryptCookiePayload } from "./crypto.ts";

export type ProviderSession = { accessToken: string; refreshToken?: string; expiresAt?: number; scope?: string; providerUserId?: string };

export const sessionCookieNames = { google: "rhythm_google_session", slack: "rhythm_slack_session" } as const;

export async function readProviderSession(provider: keyof typeof sessionCookieNames): Promise<ProviderSession | null> {
  const store = await cookies();
  return decryptCookiePayload<ProviderSession>(store.get(sessionCookieNames[provider])?.value, cookieSecret());
}

export async function writeProviderSession(provider: keyof typeof sessionCookieNames, session: ProviderSession): Promise<void> {
  const value = await encryptCookiePayload(session, cookieSecret());
  (await cookies()).set(sessionCookieNames[provider], value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/integrations", maxAge: 60 * 60 * 24 * 30 });
}

export async function clearProviderSession(provider: keyof typeof sessionCookieNames): Promise<void> {
  (await cookies()).set(sessionCookieNames[provider], "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/integrations", maxAge: 0 });
}
