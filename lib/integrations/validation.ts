import { requestFailure, type IntegrationResponse } from "./contracts.ts";

export type ManagedEventPayload = { calendarId?: unknown; taskReference?: unknown; summary?: unknown; description?: unknown; start?: unknown; end?: unknown };
export type ValidManagedEvent = { calendarId: string; taskReference: string; summary: string; description?: string; start: string; end: string };
export type ValidManagedPatch = Partial<Omit<ValidManagedEvent, "calendarId">> & { calendarId: string };

const idPattern = /^[A-Za-z0-9._:@+-]{1,256}$/;
const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/;

function boundedId(value: unknown): string | null {
  return typeof value === "string" && idPattern.test(value) ? value : null;
}

function isoTimestamp(value: unknown): string | null {
  if (typeof value !== "string" || !isoPattern.test(value)) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function invalidRequest<T = never>(message: string): IntegrationResponse<T> {
  return requestFailure("invalid_request", message);
}

export function validateManagedEventPayload(input: ManagedEventPayload | null, mode: "create" | "update" = "create"): IntegrationResponse<ValidManagedEvent | ValidManagedPatch> {
  if (!input || typeof input !== "object") return invalidRequest("A managed event payload is required.");
  const calendarId = boundedId(input.calendarId);
  if (!calendarId) return invalidRequest("The calendar ID is invalid or too long.");
  const taskReference = input.taskReference === undefined && mode === "update" ? undefined : boundedId(input.taskReference);
  if (taskReference === null || (mode === "create" && !taskReference)) return invalidRequest("The task reference is invalid or missing.");
  const summary = input.summary === undefined && mode === "update" ? undefined : typeof input.summary === "string" ? input.summary.trim() : null;
  if (summary === null || (mode === "create" && !summary) || (summary !== undefined && (summary.length < 1 || summary.length > 200))) return invalidRequest("The event title must be between 1 and 200 characters.");
  const description = input.description === undefined ? undefined : typeof input.description === "string" && input.description.length <= 4000 ? input.description : null;
  if (description === null) return invalidRequest("The event description is too long.");
  const start = input.start === undefined && mode === "update" ? undefined : isoTimestamp(input.start);
  const end = input.end === undefined && mode === "update" ? undefined : isoTimestamp(input.end);
  if (start === null || end === null || (mode === "create" && (!start || !end))) return invalidRequest("Start and end must be valid ISO timestamps.");
  if (start && end && Date.parse(end) <= Date.parse(start)) return invalidRequest("The event must end after it starts.");
  if (mode === "update" && summary === undefined && description === undefined && start === undefined && end === undefined && taskReference === undefined) return invalidRequest("At least one event field is required.");
  if (mode === "update") return { status: "connected", data: { calendarId, ...(taskReference ? { taskReference } : {}), ...(summary !== undefined ? { summary } : {}), ...(description !== undefined ? { description } : {}), ...(start ? { start } : {}), ...(end ? { end } : {}) }, error: null };
  return { status: "connected", data: { calendarId, taskReference: taskReference!, summary: summary!, ...(description !== undefined ? { description } : {}), start: start!, end: end! }, error: null };
}

export function validateManagedEventId(value: unknown, label = "event"): IntegrationResponse<string> {
  const id = boundedId(value);
  return id ? { status: "connected", data: id, error: null } : invalidRequest(`The ${label} ID is invalid or too long.`);
}
