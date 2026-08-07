const MAX_COOKIE_VALUE_BYTES = 3800;
const VERSION = "v1";

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function base64ToBytes(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, "base64url"));
}

function resolveKey(secret = process.env.INTEGRATION_COOKIE_SECRET): Uint8Array {
  if (!secret) throw new Error("INTEGRATION_COOKIE_SECRET is required");
  const key = new Uint8Array(Buffer.from(secret, "base64"));
  if (key.byteLength !== 32) throw new Error("INTEGRATION_COOKIE_SECRET must decode to 32 bytes");
  return key;
}

export class CookiePayloadTooLargeError extends Error {
  constructor() { super("Encrypted integration cookie exceeds the safe cookie size"); }
}

export async function encryptCookiePayload(payload: unknown, secret?: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", resolveKey(secret) as unknown as BufferSource, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv as unknown as BufferSource }, key, plaintext as unknown as BufferSource));
  const value = `${VERSION}.${bytesToBase64(iv)}.${bytesToBase64(ciphertext)}`;
  if (Buffer.byteLength(value, "utf8") > MAX_COOKIE_VALUE_BYTES) throw new CookiePayloadTooLargeError();
  return value;
}

export async function decryptCookiePayload<T>(value: string | undefined, secret?: string): Promise<T | null> {
  if (!value) return null;
  try {
    const [version, encodedIv, encodedCiphertext] = value.split(".");
    if (version !== VERSION || !encodedIv || !encodedCiphertext) return null;
    const key = await crypto.subtle.importKey("raw", resolveKey(secret) as unknown as BufferSource, "AES-GCM", false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: base64ToBytes(encodedIv) as unknown as BufferSource }, key, base64ToBytes(encodedCiphertext) as unknown as BufferSource);
    return JSON.parse(new TextDecoder().decode(plaintext)) as T;
  } catch {
    return null;
  }
}

export function randomToken(bytes = 32): string {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(bytes)));
}

export { MAX_COOKIE_VALUE_BYTES };
