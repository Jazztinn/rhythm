const encoder = new TextEncoder();

export const AUTH_COOKIE = "rhythm_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hmac(value: string, secret: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function constantTimeTextEqual(first: string, second: string) {
  const [firstHash, secondHash] = await Promise.all([digest(first), digest(second)]);
  let difference = 0;
  for (let index = 0; index < firstHash.length; index += 1) difference |= firstHash[index] ^ secondHash[index];
  return difference === 0;
}

export function authConfigured() {
  return Boolean(process.env.RHYTHM_AUTH_USER?.trim() && process.env.RHYTHM_AUTH_PASSWORD && process.env.RHYTHM_AUTH_SECRET?.trim().length && process.env.RHYTHM_AUTH_SECRET.trim().length >= 32);
}

export async function verifyCredentials(username: string, password: string) {
  const configuredUser = process.env.RHYTHM_AUTH_USER?.trim() ?? "";
  const configuredPassword = process.env.RHYTHM_AUTH_PASSWORD ?? "";
  const [userMatches, passwordMatches] = await Promise.all([
    constantTimeTextEqual(username.trim().toLocaleLowerCase(), configuredUser.toLocaleLowerCase()),
    constantTimeTextEqual(password, configuredPassword),
  ]);
  return authConfigured() && userMatches && passwordMatches;
}

export async function createSessionToken(username: string, now = Date.now()) {
  const secret = process.env.RHYTHM_AUTH_SECRET?.trim();
  if (!secret || secret.length < 32) throw new Error("Authentication is not configured.");
  const expires = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = `${encodeURIComponent(username.trim().toLocaleLowerCase())}.${expires}`;
  const signature = toBase64Url(await hmac(payload, secret));
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined, now = Date.now()) {
  const secret = process.env.RHYTHM_AUTH_SECRET?.trim();
  const expectedUser = process.env.RHYTHM_AUTH_USER?.trim().toLocaleLowerCase();
  if (!token || !secret || secret.length < 32 || !expectedUser) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [encodedUser, expiresText, signature] = parts;
  const expires = Number(expiresText);
  if (!Number.isSafeInteger(expires) || expires <= Math.floor(now / 1000)) return false;
  let username = "";
  try { username = decodeURIComponent(encodedUser); } catch { return false; }
  if (!(await constantTimeTextEqual(username, expectedUser))) return false;
  const expectedSignature = toBase64Url(await hmac(`${encodedUser}.${expiresText}`, secret));
  return constantTimeTextEqual(signature, expectedSignature);
}

export function safeNextPath(value: FormDataEntryValue | string | null | undefined) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/login")) return "/";
  return value;
}
