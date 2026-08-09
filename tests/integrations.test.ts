import assert from "node:assert/strict";
import test from "node:test";
import { decryptCookiePayload, encryptCookiePayload, CookiePayloadTooLargeError } from "../lib/integrations/crypto.ts";
import { classifyProviderResponse, failure, integrationHttpStatus, providerSyncState, success } from "../lib/integrations/contracts.ts";
import { isProviderConfigured, isValidCookieSecret } from "../lib/integrations/config.ts";
import { constantTimeEqual, createPkceChallenge } from "../lib/integrations/oauth.ts";
import { createManagedGoogleEvent, deleteManagedGoogleEvent, listGoogleEvents, updateManagedGoogleEvent } from "../lib/integrations/google.ts";
import { listSlackChannels, listSlackMessages } from "../lib/integrations/slack.ts";
import { validateManagedEventId, validateManagedEventPayload } from "../lib/integrations/validation.ts";
import { findCalendarConflicts } from "../lib/integrations/conflicts.ts";
import { seedTasks } from "../lib/rhythm.ts";
import { MAX_CALENDAR_RANGE_DAYS, suggestCalendarSlots, validateVisibleCalendarRange } from "../lib/integrations/calendar-context.ts";
import { identifySlackCommitment } from "../lib/integrations/slack-commitments.ts";
import { buildContextualNotification, isQuietTime } from "../lib/integrations/notifications.ts";

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
  assert.equal(integrationHttpStatus("permission_denied"), 403);
  assert.equal(integrationHttpStatus("rate_limited"), 429);
  assert.equal(providerSyncState("not_connected"), "disconnected");
  assert.equal(providerSyncState("token_expired"), "permission_revoked");
  assert.equal(providerSyncState("provider_unavailable"), "sync_failed");
  assert.equal(providerSyncState("connected", { syncing: true }), "syncing");
  assert.equal(providerSyncState("connected", { hasConflict: true }), "conflict");
});

test("bounds Calendar projection and suggests slots only from visible connected context", () => {
  const range = validateVisibleCalendarRange("2026-08-10T00:00:00Z", "2026-08-17T00:00:00Z");
  assert.equal(range.status, "connected");
  assert.equal(MAX_CALENDAR_RANGE_DAYS, 62);
  const unbounded = validateVisibleCalendarRange("2026-01-01T00:00:00Z", "2026-12-31T00:00:00Z");
  assert.equal(unbounded.status, "invalid_request");
  const slots = suggestCalendarSlots([{ id: "meeting", calendarId: "primary", summary: "Meeting", start: "2026-08-10T09:00:00Z", end: "2026-08-10T10:00:00Z" }], "2026-08-10T08:00:00Z", "2026-08-10T12:00:00Z", 60, 2);
  assert.equal(slots.length, 2);
  assert.equal(slots[0].evidence, "google_calendar");
  assert.notEqual(slots[0].start, "2026-08-10T09:00:00.000Z");
});

test("Slack commitment context remains a proposal, not an automatic task", () => {
  const base = { id: "C1:1", channelId: "C1", user: "U1", timestamp: "1" };
  assert.equal(identifySlackCommitment({ ...base, text: "Good morning everyone" }), null);
  const commitment = identifySlackCommitment({ ...base, text: "Could you review the membership sheet by Friday?" });
  assert.equal(commitment?.sourceMessageId, "C1:1");
  assert.match(commitment?.reason ?? "", /Review before creating/i);
});

test("notifications use confirmed context only and respect quiet hours", () => {
  const now = new Date("2026-08-10T19:00:00");
  assert.equal(isQuietTime(now, { start: "18:00", end: "08:00" }), true);
  assert.equal(buildContextualNotification({ now, quietHours: { start: "18:00", end: "08:00" }, confirmedPatterns: [], allowReassurance: true }), null);
  const unconfirmed = buildContextualNotification({ now, confirmedPatterns: [{ status: "still_learning", category: "Admin", windowStart: "18:00", windowEnd: "20:00" }], openItem: { title: "Reply", category: "Admin", urgent: false } });
  assert.equal(unconfirmed, null);
  const confirmed = buildContextualNotification({ now, confirmedPatterns: [{ status: "confirmed", category: "Admin", windowStart: "18:00", windowEnd: "20:00" }], openItem: { title: "Reply", category: "Admin", urgent: false } });
  assert.match(confirmed?.reason ?? "", /confirmed/i);
});

test("requires a valid base64 32-byte cookie secret before a provider is configured", () => {
  const keys = ["INTEGRATION_COOKIE_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REDIRECT_URI"] as const;
  const prior = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.GOOGLE_CLIENT_ID = "client";
  process.env.GOOGLE_CLIENT_SECRET = "secret";
  process.env.GOOGLE_REDIRECT_URI = "http://localhost/callback";
  process.env.INTEGRATION_COOKIE_SECRET = "not-a-key";
  assert.equal(isValidCookieSecret(), false);
  assert.equal(isProviderConfigured("google"), false);
  process.env.INTEGRATION_COOKIE_SECRET = secret;
  assert.equal(isValidCookieSecret(), true);
  assert.equal(isProviderConfigured("google"), true);
  for (const key of keys) { if (prior[key] === undefined) delete process.env[key]; else process.env[key] = prior[key]; }
});

test("rejects invalid managed event input before any provider call", async () => {
  const invalid = validateManagedEventPayload({ calendarId: "primary", taskReference: "task-1", summary: "Too late", start: "2026-08-10T11:00:00Z", end: "2026-08-10T10:00:00Z" });
  assert.equal(invalid.status, "invalid_request");
  assert.equal(invalid.error?.code, "invalid_request");
  assert.equal(validateManagedEventId("x".repeat(257), "event").status, "invalid_request");
  let called = 0;
  const result = await createManagedGoogleEvent("token", { calendarId: "primary", taskReference: "task-1", summary: "Invalid", start: "not-iso", end: "also-not-iso" }, async () => { called += 1; return Response.json({}); });
  assert.equal(result.status, "invalid_request");
  assert.equal(called, 0);
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
  let deleteCalls = 0;
  const managedDelete = await deleteManagedGoogleEvent("token", "primary", "managed", async (input, init) => {
    deleteCalls += 1;
    if (init?.method === "DELETE") return new Response(null, { status: 204 });
    return Response.json({ id: "managed", extendedProperties: { private: { rhythmManaged: "true" } } });
  });
  assert.deepEqual(managedDelete, { status: "connected", data: { deleted: true }, error: null });
  assert.equal(deleteCalls, 2);
  let externalDeleteCalls = 0;
  const rejectedDelete = await deleteManagedGoogleEvent("token", "primary", "external", async () => { externalDeleteCalls += 1; return Response.json({ id: "external", extendedProperties: { private: {} } }); });
  assert.equal(rejectedDelete.status, "permission_denied");
  assert.equal(externalDeleteCalls, 1);
  assert.equal(requests[0].headers.get("authorization"), "Bearer token");
});

test("Slack normalizes snake_case channels, filters non-members, paginates, and classifies revoked tokens", async () => {
  let channelRequest = "";
  const fetchMock = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).includes("conversations.list")) { channelRequest = String(init?.body ?? ""); return Response.json({ ok: true, channels: [{ id: "pub", name: "general", is_private: false, is_member: true }, { id: "not-installed", name: "announcements", is_private: false, is_member: false }, { id: "priv", name: "secret", is_private: true, is_member: true }], response_metadata: { next_cursor: "next" } }); }
    return Response.json({ ok: true, messages: [{ ts: "1.2", text: "<script>ignore</script> do work", user: "U1" }] });
  };
  const channels = await listSlackChannels("token", "cursor-2", fetchMock);
  assert.deepEqual(channels.data?.channels.map((channel) => channel.id), ["pub"]);
  assert.equal(channels.data?.channels[0].isMember, true);
  assert.match(channelRequest, /cursor=cursor-2/);
  const messages = await listSlackMessages("token", "pub", "", fetchMock);
  assert.equal(messages.data?.messages[0].text, "<script>ignore</script> do work");
  const revoked = await listSlackChannels("revoked", "", async () => Response.json({ ok: false, error: "token_revoked" }));
  assert.equal(revoked.status, "token_expired");
});

test("reports visible provider conflicts with local timed tasks", () => {
  const task = { ...seedTasks[0], id: "focus", title: "Focus block", dueDate: "2026-08-10", dueTime: "10:30", estimateMinutes: 60 };
  const conflicts = findCalendarConflicts([{ id: "event", calendarId: "primary", summary: "Doctor", start: "2026-08-10T10:00:00+08:00", end: "2026-08-10T11:00:00+08:00" }], [task]);
  assert.deepEqual(conflicts, { event: ["Focus block"] });
});
