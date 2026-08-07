import { classifyProviderError, classifyProviderResponse, failure, success, type IntegrationResponse } from "./contracts.ts";
import type { ProviderSession } from "./session.ts";

const GOOGLE_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";

export type GoogleCalendar = { id: string; summary: string; primary?: boolean; accessRole?: string };
export type GoogleEvent = { id: string; calendarId: string; summary: string; description?: string; start: string; end: string; htmlLink?: string; status?: string; rhythmManaged?: boolean; taskReference?: string };
type FetchLike = typeof fetch;

function errorResponse<T>(error: unknown): IntegrationResponse<T> {
  const code = classifyProviderError(error);
  return failure(code, code === "offline" ? "Google Calendar is unavailable offline." : "Google Calendar could not be reached.", code === "offline" || code === "provider_unavailable");
}

async function request<T>(token: string, path: string, init: RequestInit = {}, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<T>> {
  try {
    const response = await fetchImpl(`${GOOGLE_API}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, accept: "application/json", ...init.headers } });
    if (!response.ok) {
      const code = classifyProviderResponse(response.status);
      return failure(code, `Google Calendar returned ${response.status}.`, code === "rate_limited" || code === "provider_unavailable");
    }
    return success(await response.json() as T);
  } catch (error) { return errorResponse<T>(error); }
}

export function googleAuthorizationUrl(state: string, challenge: string, redirect: string): string {
  const params = new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", redirect_uri: redirect, response_type: "code", access_type: "offline", prompt: "consent", scope: "https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events.owned", state, code_challenge: challenge, code_challenge_method: "S256" });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

export async function exchangeGoogleCode(code: string, verifier: string, redirect: string, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<ProviderSession>> {
  try {
    const response = await fetchImpl(GOOGLE_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", redirect_uri: redirect, grant_type: "authorization_code", code_verifier: verifier }) });
    if (!response.ok) return failure(classifyProviderResponse(response.status), "Google authorization was not accepted.");
    const body = await response.json() as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; sub?: string };
    if (!body.access_token) return failure("provider_unavailable", "Google did not return an access token.");
    return success({ accessToken: body.access_token, refreshToken: body.refresh_token, expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined, scope: body.scope, providerUserId: body.sub });
  } catch (error) { return errorResponse<ProviderSession>(error); }
}

export async function refreshGoogleSession(session: ProviderSession, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<ProviderSession>> {
  if (!session.refreshToken) return failure("token_expired", "Reconnect Google Calendar to continue.");
  try {
    const response = await fetchImpl(GOOGLE_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID ?? "", client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "", refresh_token: session.refreshToken, grant_type: "refresh_token" }) });
    if (!response.ok) return failure(classifyProviderResponse(response.status), "Google token refresh was not accepted.", response.status >= 500);
    const body = await response.json() as { access_token?: string; expires_in?: number; scope?: string };
    if (!body.access_token) return failure("token_expired", "Reconnect Google Calendar to continue.");
    return success({ ...session, accessToken: body.access_token, expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : undefined, scope: body.scope ?? session.scope });
  } catch (error) { return errorResponse<ProviderSession>(error); }
}

export async function listGoogleCalendars(token: string, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<GoogleCalendar[]>> {
  const result = await request<{ items?: GoogleCalendar[] }>(token, "/users/me/calendarList?minAccessRole=reader&showDeleted=false", {}, fetchImpl);
  return result.data ? success(result.data.items ?? []) : result as IntegrationResponse<GoogleCalendar[]>;
}

export async function listGoogleEvents(token: string, calendarIds: string[], timeMin: string, timeMax: string, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<GoogleEvent[]>> {
  const ids = calendarIds.length ? calendarIds : ["primary"];
  try {
    const groups = await Promise.all(ids.map(async (calendarId) => {
      const params = new URLSearchParams({ timeMin, timeMax, singleEvents: "true", orderBy: "startTime", showDeleted: "false", maxResults: "2500" });
      const response = await request<{ items?: Array<{ id: string; summary?: string; description?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; htmlLink?: string; status?: string; extendedProperties?: { private?: Record<string, string> } }> }>(token, `/calendars/${encodeURIComponent(calendarId)}/events?${params}`, {}, fetchImpl);
      if (!response.data) return response as IntegrationResponse<GoogleEvent[]>;
      return success((response.data.items ?? []).map((event) => ({ id: event.id, calendarId, summary: event.summary ?? "Untitled event", description: event.description, start: event.start?.dateTime ?? `${event.start?.date ?? ""}T00:00:00`, end: event.end?.dateTime ?? `${event.end?.date ?? ""}T23:59:00`, htmlLink: event.htmlLink, status: event.status, rhythmManaged: event.extendedProperties?.private?.rhythmManaged === "true", taskReference: event.extendedProperties?.private?.rhythmTaskReference })));
    }));
    const failed = groups.find((group) => group.error);
    if (failed) return failed;
    return success(groups.flatMap((group) => group.data ?? []));
  } catch (error) { return errorResponse<GoogleEvent[]>(error); }
}

type ManagedEventInput = { calendarId: string; taskReference: string; summary: string; description?: string; start: string; end: string };

async function verifyManagedEvent(token: string, calendarId: string, eventId: string, fetchImpl: FetchLike): Promise<IntegrationResponse<boolean>> {
  const result = await request<{ extendedProperties?: { private?: Record<string, string> } }>(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {}, fetchImpl);
  if (!result.data) return result as unknown as IntegrationResponse<boolean>;
  return result.data.extendedProperties?.private?.rhythmManaged === "true" ? success(true) : failure("permission_denied", "External calendar events are read-only.");
}

export async function createManagedGoogleEvent(token: string, input: ManagedEventInput, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<GoogleEvent>> {
  const result = await request<{ id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string }; extendedProperties?: { private?: Record<string, string> } }>(token, `/calendars/${encodeURIComponent(input.calendarId)}/events`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: input.summary, description: input.description, start: { dateTime: input.start }, end: { dateTime: input.end }, extendedProperties: { private: { rhythmManaged: "true", rhythmTaskReference: input.taskReference } } }) }, fetchImpl);
  return result.data ? success({ id: result.data.id, calendarId: input.calendarId, summary: result.data.summary ?? input.summary, description: input.description, start: result.data.start?.dateTime ?? input.start, end: result.data.end?.dateTime ?? input.end, rhythmManaged: true, taskReference: input.taskReference }) : result as IntegrationResponse<GoogleEvent>;
}

export async function updateManagedGoogleEvent(token: string, calendarId: string, eventId: string, input: Partial<Omit<ManagedEventInput, "calendarId">>, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<GoogleEvent>> {
  const verified = await verifyManagedEvent(token, calendarId, eventId, fetchImpl);
  if (verified.error) return verified as unknown as IntegrationResponse<GoogleEvent>;
  const result = await request<{ id: string; summary?: string; start?: { dateTime?: string }; end?: { dateTime?: string }; extendedProperties?: { private?: Record<string, string> } }>(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: input.summary, description: input.description, start: input.start ? { dateTime: input.start } : undefined, end: input.end ? { dateTime: input.end } : undefined }) }, fetchImpl);
  return result.data ? success({ id: result.data.id, calendarId, summary: result.data.summary ?? input.summary ?? "Rhythm event", description: input.description, start: result.data.start?.dateTime ?? input.start ?? "", end: result.data.end?.dateTime ?? input.end ?? "", rhythmManaged: true, taskReference: input.taskReference }) : result as IntegrationResponse<GoogleEvent>;
}

export async function deleteManagedGoogleEvent(token: string, calendarId: string, eventId: string, fetchImpl: FetchLike = fetch): Promise<IntegrationResponse<{ deleted: true }>> {
  const verified = await verifyManagedEvent(token, calendarId, eventId, fetchImpl);
  if (verified.error) return verified as unknown as IntegrationResponse<{ deleted: true }>;
  return request<{ deleted: true }>(token, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: "DELETE" }, fetchImpl).then((result) => result.error ? result : success({ deleted: true }));
}
