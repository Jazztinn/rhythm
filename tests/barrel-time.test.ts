import assert from "node:assert/strict";
import test from "node:test";
import { formatBarrelTime, parseBarrelTime, replaceLocalDate, replaceLocalTime } from "../lib/barrel-time.ts";

test("barrel time converts midnight and noon", () => {
  assert.deepEqual(parseBarrelTime("00:00"), { hour: 12, minute: 0, period: "AM" });
  assert.deepEqual(parseBarrelTime("12:00"), { hour: 12, minute: 0, period: "PM" });
  assert.equal(formatBarrelTime(12, 0, "AM"), "00:00");
  assert.equal(formatBarrelTime(12, 0, "PM"), "12:00");
});

test("barrel time rounds to five-minute options and uses safe empty default", () => {
  assert.deepEqual(parseBarrelTime("09:03"), { hour: 9, minute: 5, period: "AM" });
  assert.deepEqual(parseBarrelTime("23:58"), { hour: 11, minute: 0, period: "PM" });
  assert.deepEqual(parseBarrelTime(""), { hour: 9, minute: 0, period: "AM" });
});

test("calendar local datetime replacement preserves untouched half", () => {
  assert.equal(replaceLocalDate("2026-08-12T09:30", "2026-08-15"), "2026-08-15T09:30");
  assert.equal(replaceLocalTime("2026-08-12T09:30", "14:45"), "2026-08-12T14:45");
});
