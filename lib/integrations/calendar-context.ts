import type { GoogleEvent } from "./google.ts";
import { invalidRequest } from "./validation.ts";

export const MAX_CALENDAR_RANGE_DAYS = 62;
export const MAX_PROJECTED_PROVIDER_EVENTS = 1_000;

export type CalendarSlot = {
  start: string;
  end: string;
  label: "Suggested" | "Alternate";
  evidence: "google_calendar";
};

export function validateVisibleCalendarRange(start: unknown, end: unknown) {
  if (typeof start !== "string" || typeof end !== "string") return invalidRequest("Choose a visible Calendar date range.");
  const from = Date.parse(start);
  const to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from) return invalidRequest("Choose a valid Calendar date range.");
  if (to - from > MAX_CALENDAR_RANGE_DAYS * 86_400_000) return invalidRequest(`Calendar can show up to ${MAX_CALENDAR_RANGE_DAYS} days at once.`);
  return { status: "connected" as const, data: { start: new Date(from).toISOString(), end: new Date(to).toISOString() }, error: null };
}

function overlaps(start: number, end: number, event: GoogleEvent) {
  const eventStart = Date.parse(event.start);
  const eventEnd = Date.parse(event.end);
  return Number.isFinite(eventStart) && Number.isFinite(eventEnd) && start < eventEnd && eventStart < end && event.status !== "cancelled";
}

export function suggestCalendarSlots(events: GoogleEvent[], rangeStart: string, rangeEnd: string, durationMinutes: number, limit = 3): CalendarSlot[] {
  const start = Date.parse(rangeStart);
  const end = Date.parse(rangeEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || durationMinutes < 5 || durationMinutes > 480) return [];
  const duration = durationMinutes * 60_000;
  const slots: CalendarSlot[] = [];
  const cursor = new Date(start);
  cursor.setMinutes(Math.ceil(cursor.getMinutes() / 30) * 30, 0, 0);
  while (cursor.getTime() + duration <= end && slots.length < Math.min(Math.max(limit, 1), 6)) {
    const hour = cursor.getHours();
    const candidateStart = cursor.getTime();
    const candidateEnd = candidateStart + duration;
    if (hour >= 8 && hour < 20 && !events.some((event) => overlaps(candidateStart, candidateEnd, event))) {
      slots.push({ start: new Date(candidateStart).toISOString(), end: new Date(candidateEnd).toISOString(), label: slots.length ? "Alternate" : "Suggested", evidence: "google_calendar" });
    }
    cursor.setMinutes(cursor.getMinutes() + 30);
  }
  return slots;
}
