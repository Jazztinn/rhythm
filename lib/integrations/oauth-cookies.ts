import { cookies } from "next/headers";
import { cookieSecret } from "./config.ts";
import { decryptCookiePayload, encryptCookiePayload } from "./crypto.ts";

const maxAge = 60 * 10;
export const oauthCookieNames = { google: "rhythm_google_oauth", slack: "rhythm_slack_oauth" } as const;
export type OAuthCookie = { state: string; verifier?: string; createdAt: number };

export async function writeOAuthCookie(provider: keyof typeof oauthCookieNames, value: OAuthCookie): Promise<void> {
  const encrypted = await encryptCookiePayload(value, cookieSecret());
  (await cookies()).set(oauthCookieNames[provider], encrypted, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: `/api/integrations/${provider}`, maxAge });
}

export async function readOAuthCookie(provider: keyof typeof oauthCookieNames): Promise<OAuthCookie | null> {
  const value = await decryptCookiePayload<OAuthCookie>((await cookies()).get(oauthCookieNames[provider])?.value, cookieSecret());
  return value && Date.now() - value.createdAt <= maxAge * 1000 ? value : null;
}

export async function clearOAuthCookie(provider: keyof typeof oauthCookieNames): Promise<void> {
  (await cookies()).set(oauthCookieNames[provider], "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: `/api/integrations/${provider}`, maxAge: 0 });
}
