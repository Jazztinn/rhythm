"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, RefreshCw, WifiOff } from "lucide-react";
import { Button, StatusMessage } from "@/components/ui";
import { ConfirmAction, Dialog } from "@/components/ui";
import { integrationFetch } from "@/lib/integrations/client";
import type { GoogleCalendar, GoogleEvent } from "@/lib/integrations/google";
import type { IntegrationResponse } from "@/lib/integrations/contracts";
import type { Task } from "@/lib/rhythm";
import { findCalendarConflicts } from "@/lib/integrations/conflicts";

const CALENDAR_SELECTION_KEY = "rhythm.selectedCalendarIds";

export function GoogleCalendarPanel({ start, end, tasks }: { start: string; end: string; tasks: Task[] }) {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selected, setSelected] = useState<string[]>(["primary"]);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [result, setResult] = useState<IntegrationResponse<GoogleEvent[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [offline, setOffline] = useState(false);
  const [dialog, setDialog] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<GoogleEvent | null>(null);
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [summary, setSummary] = useState(tasks[0]?.title ?? "");
  const [startInput, setStartInput] = useState(start.slice(0, 16));
  const [endInput, setEndInput] = useState(end.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const conflicts = useMemo(() => findCalendarConflicts(events, tasks), [events, tasks]);
  useEffect(() => { const timer = window.setTimeout(() => { try { const value = JSON.parse(window.localStorage.getItem(CALENDAR_SELECTION_KEY) ?? "null"); if (Array.isArray(value) && value.length && value.every((item) => typeof item === "string")) setSelected(value); } catch { /* ignore malformed local selection */ } }, 0); return () => window.clearTimeout(timer); }, []);
  const selectedQuery = useMemo(() => selected.join(","), [selected]);
  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await integrationFetch<GoogleEvent[]>(`/api/integrations/google/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&calendars=${encodeURIComponent(selectedQuery)}`);
    setResult(response); if (response.data) setEvents(response.data); setOffline(response.status === "offline"); setLoading(false);
  }, [end, selectedQuery, start]);
  // Provider refresh is an external request; its async state update is intentionally effect-driven.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);
  async function loadCalendars() { const response = await integrationFetch<GoogleCalendar[]>("/api/integrations/google/calendars"); if (response.data) setCalendars(response.data); }
  function toggleCalendar(id: string) { const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id]; const normalized = next.length ? next : ["primary"]; setSelected(normalized); localStorage.setItem(CALENDAR_SELECTION_KEY, JSON.stringify(normalized)); }
  function openCreate() { const task = tasks.find((item) => item.id === taskId) ?? tasks[0]; setEditing(null); setTaskId(task?.id ?? ""); setSummary(task?.title ?? ""); setStartInput(start.slice(0, 16)); setEndInput(end.slice(0, 16)); setDialog("create"); }
  function openEdit(event: GoogleEvent) { setEditing(event); setTaskId(event.taskReference ?? ""); setSummary(event.summary); setStartInput(event.start.slice(0, 16)); setEndInput(event.end.slice(0, 16)); setDialog("edit"); }
  async function saveManagedEvent() {
    setSaving(true);
    const selectedTask = tasks.find((task) => task.id === taskId);
    const payload = { calendarId: selected[0] ?? "primary", taskReference: taskId || selectedTask?.id, summary: summary.trim(), start: new Date(startInput).toISOString(), end: new Date(endInput).toISOString() };
    const response = await integrationFetch<GoogleEvent>(dialog === "edit" && editing ? `/api/integrations/google/events/${encodeURIComponent(editing.id)}` : "/api/integrations/google/events/managed", { method: dialog === "edit" ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false); if (response.error) { setResult(response as unknown as IntegrationResponse<GoogleEvent[]>); return; } setDialog(null); await refresh();
  }
  return <section className="provider-calendar-panel" aria-labelledby="provider-calendar-heading">
    <div className="section-heading compact"><div><span className="section-kicker"><CalendarClock size={14} /> Google Calendar</span><h2 id="provider-calendar-heading">Provider events</h2></div><div className="provider-panel-actions"><Button onClick={() => void refresh()} disabled={loading || offline} title={offline ? "Reconnect to refresh provider events" : "Refresh provider events"}><RefreshCw size={14} /> {loading ? "Syncing…" : "Refresh"}</Button><Button onClick={() => void loadCalendars()}>Select calendars</Button><Button variant="primary" onClick={openCreate} disabled={offline || result?.status !== "connected" || !tasks.length} title={!tasks.length ? "Add a local task first" : result?.status !== "connected" ? "Connect Google Calendar to schedule" : "Schedule a managed event"}>Schedule task</Button></div></div>
    {offline ? <StatusMessage><WifiOff size={15} /> Offline. Local tasks remain editable; provider events are from the last successful sync.</StatusMessage> : null}
    {result?.error && result.status !== "offline" ? <StatusMessage tone="error">{result.error.message} {result.error.retryable ? <Button onClick={() => void refresh()}>Try again</Button> : null}</StatusMessage> : null}
    {calendars.length ? <div className="provider-selection" aria-label="Calendar selection">{calendars.map((calendar) => <label key={calendar.id}><input type="checkbox" checked={selected.includes(calendar.id)} onChange={() => toggleCalendar(calendar.id)} />{calendar.summary}{calendar.primary ? " · primary" : ""}</label>)}</div> : null}
    <div className="provider-event-list">{events.length ? events.map((event) => <article key={`${event.calendarId}:${event.id}`} className={`provider-event ${event.rhythmManaged ? "is-managed" : "is-external"} ${conflicts[event.id]?.length ? "has-conflict" : ""}`}><div><span>{event.rhythmManaged ? "Rhythm managed" : "External · read-only"}</span><strong>{event.summary}</strong><small>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.start))}</small>{conflicts[event.id]?.map((title) => <p className="provider-conflict" key={title} role="status">Conflict with local task: {title}</p>)}</div><div className="provider-event__actions">{event.htmlLink ? <a href={event.htmlLink} target="_blank" rel="noreferrer">Open</a> : null}{event.rhythmManaged ? <><Button onClick={() => openEdit(event)}>Edit</Button><ConfirmAction label="Delete" title="Delete this managed event?" description="This deletes only the Rhythm-managed provider event. External events remain read-only and untouched." confirmLabel="Delete event" tone="danger" onConfirm={async () => { const response = await integrationFetch(`/api/integrations/google/events/${encodeURIComponent(event.id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ calendarId: event.calendarId }) }); if (response.error) setResult(response as unknown as IntegrationResponse<GoogleEvent[]>); else await refresh(); }} /></> : null}</div></article>) : <p className="provider-empty">No provider events in this visible range. Your local tasks are still shown above.</p>}</div>
    {dialog ? <Dialog open onClose={() => setDialog(null)} title={dialog === "edit" ? "Edit managed block" : "Schedule managed block"}><p className="ui-dialog__description">Only Rhythm-managed events can be changed. Your approval here is required before any remote mutation.</p><label className="integration-field">Task<select value={taskId} onChange={(event) => { setTaskId(event.target.value); const task = tasks.find((item) => item.id === event.target.value); if (task) setSummary(task.title); }}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label className="integration-field">Title<input value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label className="integration-field">Starts<input type="datetime-local" value={startInput} onChange={(event) => setStartInput(event.target.value)} /></label><label className="integration-field">Ends<input type="datetime-local" value={endInput} onChange={(event) => setEndInput(event.target.value)} /></label><div className="ui-dialog__actions"><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" disabled={saving || !summary.trim() || !taskId} onClick={() => void saveManagedEvent()}>{saving ? "Saving…" : dialog === "edit" ? "Save changes" : "Schedule"}</Button></div></Dialog> : null}
  </section>;
}
