import assert from "node:assert/strict";
import test from "node:test";
import { authConfigured, createSessionToken, safeNextPath, verifyCredentials, verifySessionToken } from "../lib/auth.ts";

const prior = {
  user: process.env.RHYTHM_AUTH_USER,
  password: process.env.RHYTHM_AUTH_PASSWORD,
  secret: process.env.RHYTHM_AUTH_SECRET,
};

function configure() {
  process.env.RHYTHM_AUTH_USER = "jazz";
  process.env.RHYTHM_AUTH_PASSWORD = "correct horse battery staple";
  process.env.RHYTHM_AUTH_SECRET = "0123456789abcdef0123456789abcdef";
}

test.after(() => {
  if (prior.user === undefined) delete process.env.RHYTHM_AUTH_USER; else process.env.RHYTHM_AUTH_USER = prior.user;
  if (prior.password === undefined) delete process.env.RHYTHM_AUTH_PASSWORD; else process.env.RHYTHM_AUTH_PASSWORD = prior.password;
  if (prior.secret === undefined) delete process.env.RHYTHM_AUTH_SECRET; else process.env.RHYTHM_AUTH_SECRET = prior.secret;
});

test("auth configuration and credential checks remain server controlled", async () => {
  configure();
  assert.equal(authConfigured(), true);
  assert.equal(await verifyCredentials("Jazz", "correct horse battery staple"), true);
  assert.equal(await verifyCredentials("Jazz", "wrong"), false);
});

test("signed sessions expire and reject tampering", async () => {
  configure();
  const now = Date.UTC(2026, 7, 13);
  const token = await createSessionToken("jazz", now);
  assert.equal(await verifySessionToken(token, now + 1_000), true);
  assert.equal(await verifySessionToken(`${token}x`, now + 1_000), false);
  assert.equal(await verifySessionToken(token, now + 8 * 24 * 60 * 60 * 1_000), false);
});

test("post-login redirects stay local", () => {
  assert.equal(safeNextPath("/calendar?view=week"), "/calendar?view=week");
  assert.equal(safeNextPath("https://example.com"), "/");
  assert.equal(safeNextPath("//example.com"), "/");
  assert.equal(safeNextPath("/login?next=/tasks"), "/");
});
