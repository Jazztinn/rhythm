import assert from "node:assert/strict";
import test from "node:test";
import { decryptCookiePayload, encryptCookiePayload, CookiePayloadTooLargeError } from "../lib/integrations/crypto.ts";
import { classifyProviderResponse, failure, success } from "../lib/integrations/contracts.ts";
import { constantTimeEqual, createPkceChallenge } from "../lib/integrations/oauth.ts";
import { createManagedGoogleEvent, listGoogleEvents, updateManagedGoogleEvent } from "../lib/integrations/google.ts";
import { listSlackChannels, listSlackMessages } from "../lib/integrations/slack.ts";

const secret = Buffer.alloc(32, 7).toString("base64");

test("encrypts and decrypts integration cookies, while rotation invalidates old keys", async () => {
  const encrypted = await encryptCookiePayload({ accessToken: "server-only", expiresAt: 10 }, secret);
  assert.equal((await decryptCookiePayload<{ accessToken: string }>(encrypted, secret))?.accessToken, "server-only");
  assert.equal(await decryptCookiePayload(encrypted, Buffer.alloc(32, 8).toString("base64")), null);
  await assert.rejects(() => encryptCookiePayload({ value: "x".repeat(4000) }, secret), CookiePayloadTooLargeError);
});

test("uses S256 PKCE and constant-time OAuth state comparison", () => {
  assert.match(createPkceChallenge("test-verifier"), /^[A-Za-z0-9_-]{43}$/);
  assert.equal(constantTimeEqual("state", "state"), true);
  assert.equal(constantTimeEqual("state", "other"), false);
  assert.equal(constantTimeEqual(undefined, "state"), false);
});

test("normalizes expected provider errors and responses", () => {
  assert.equal(classifyProviderResponse(401), "token_expired");
  assert.equal(classifyProviderResponse(403), "permission_denied");
  assert.equal(classifyProviderResponse(429), "rate_limited");
  assert.deepEqual(success({ ok: true }), { status: "connected", data: { ok: true }, error: null });
  assert.equal(failure("offline", "offline", true).error?.retryable, true);
});

test("Google reads events and never mutates an untagged external event", async () => {
  const requests: Request[] = [];
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    requests.push(new Request(input, init));
    const url = String(input);
    if (url.includes("/events?") ) return Response.json({ items: [{ id: "external", summary: "Doctor", start: { dateTime: "2026-08-10T10:00:00Z" }, end: { dateTime: "2026-08-10T11:00:00Z" }, extendedProperties: { private: {} } }] });
    if (url.includes("/events/external")) return Response.json({ id: "external", extendedProperties: { private: {} } });
    return Response.json({});
  };
  const listed = await listGoogleEvents("token", ["primary"], "2026-08-10T00:00:00Z", "2026-08-11T00:00:00Z", fetchMock);
  assert.equal(listed.data?.[0].rhythmManaged, false);
  const mutation = await createManagedGoogleEvent("token", { calendarId: "primary", taskReference: "task-1", summary: "Focus", start: "2026-08-10T12:00:00Z", end: "2026-08-10T13:00:00Z" }, async () => Response.json({ id: "managed", summary: "Focus", start: { dateTime: "2026-08-10T12:00:00Z" }, end: { dateTime: "2026-08-10T13:00:00Z" }, extendedProperties: { private: { rhythmManaged: "true" } } }));
  assert.equal(mutation.data?.rhythmManaged, true);
  const rejected = await updateManagedGoogleEvent("token", "primary", "external", { summary: "Do not touch" }, fetchMock);
  assert.equal(rejected.status, "permission_denied");
  assert.equal(requests[0].headers.get("authorization"), "Bearer token");
});

test("Slack only exposes public channels and preserves message text as plain data", async () => {
  const fetchMock = async (input: RequestInfo | URL) => {
    if (String(input).includes("conversations.list")) return Response.json({ ok: true, channels: [{ id: "pub", name: "general", isPrivate: false }, { id: "priv", name: "secret", isPrivate: true }], response_metadata: { next_cursor: "next" } });
    return Response.json({ ok: true, messages: [{ ts: "1.2", text: "<script>ignore</script> do work", user: "U1" }] });
  };
  const channels = await listSlackChannels("token", "", fetchMock);
  assert.deepEqual(channels.data?.channels.map((channel) => channel.id), ["pub"]);
  const messages = await listSlackMessages("token", "pub", "", fetchMock);
  assert.equal(messages.data?.messages[0].text, "<script>ignore</script> do work");
});
