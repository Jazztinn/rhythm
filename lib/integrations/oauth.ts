import { createHash } from "node:crypto";
import { randomToken } from "./crypto.ts";

export function createPkceVerifier(): string { return randomToken(32); }

export function createPkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function createOAuthState(): string { return randomToken(24); }

export function constantTimeEqual(left: string | undefined, right: string | undefined): boolean {
  if (!left || !right || left.length !== right.length) return false;
  let result = 0;
  for (let index = 0; index < left.length; index += 1) result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return result === 0;
}
