import type { Task } from "../rhythm.ts";
import type { GoogleEvent } from "./google.ts";

function taskWindow(task: Task): { start: number; end: number } | null {
  if (!task.dueDate || !task.dueTime) return null;
  const start = new Date(`${task.dueDate}T${task.dueTime}:00`).getTime();
  if (!Number.isFinite(start)) return null;
  return { start, end: start + task.estimateMinutes * 60_000 };
}

export function findCalendarConflicts(events: GoogleEvent[], tasks: Task[]): Record<string, string[]> {
  return Object.fromEntries(events.flatMap((event) => {
    const eventStart = new Date(event.start).getTime();
    const eventEnd = new Date(event.end).getTime();
    if (!Number.isFinite(eventStart) || !Number.isFinite(eventEnd)) return [];
    const titles = tasks.filter((task) => { const window = taskWindow(task); return window ? window.start < eventEnd && eventStart < window.end : false; }).map((task) => task.title);
    return titles.length ? [[event.id, titles] as const] : [];
  }));
}
