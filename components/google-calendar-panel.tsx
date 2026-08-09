"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, RefreshCw, RotateCcw, WifiOff } from "lucide-react";
import { Button, ConfirmAction, Dialog, StatusMessage } from "@/components/ui";
import { integrationFetch } from "@/lib/integrations/client";
import { providerSyncState, type IntegrationResponse } from "@/lib/integrations/contracts";
import { findCalendarConflicts } from "@/lib/integrations/conflicts";
import { suggestCalendarSlots, type CalendarSlot } from "@/lib/integrations/calendar-context";
import type { GoogleCalendar, GoogleEvent } from "@/lib/integrations/google";
import type { Task } from "@/lib/rhythm";

const CALENDAR_SELECTION_KEY = "rhythm.selectedCalendarIds";
type DialogStep = "create" | "edit" | "preview";
type MutationReceipt = { message: string; undo?: () => Promise<void> };

function formatSlot(slot: Pick<CalendarSlot, "start" | "end">) {
  const formatter = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return `${formatter.format(new Date(slot.start))} – ${formatter.format(new Date(slot.end))}`;
}

function toLocalInput(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function GoogleCalendarPanel({ start, end, tasks }: { start: string; end: string; tasks: Task[] }) {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [selected, setSelected] = useState<string[]>(["primary"]);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [result, setResult] = useState<IntegrationResponse<GoogleEvent[]> | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [dialog, setDialog] = useState<DialogStep | null>(null);
  const [editing, setEditing] = useState<GoogleEvent | null>(null);
  const [taskId, setTaskId] = useState(tasks[0]?.id ?? "");
  const [summary, setSummary] = useState(tasks[0]?.title ?? "");
  const [startInput, setStartInput] = useState(start.slice(0, 16));
  const [endInput, setEndInput] = useState(end.slice(0, 16));
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<MutationReceipt | null>(null);
  const conflicts = useMemo(() => findCalendarConflicts(events, tasks), [events, tasks]);
  const hasConflict = Object.keys(conflicts).length > 0;
  const selectedTask = tasks.find((task) => task.id === taskId);
  const slots = useMemo(() => suggestCalendarSlots(events, start, end, selectedTask?.estimateMinutes ?? 30), [end, events, selectedTask?.estimateMinutes, start]);
  const syncState = providerSyncState(result?.status ?? "not_connected", { syncing: loading, hasConflict });
  const syncCopy = {
    not_configured: "Google Calendar is not configured.", syncing: "Syncing the visible dates…", sync_failed: "Calendar sync failed.",
    disconnected: "Connect Calendar to help Rhythm understand your time.", permission_revoked: "Calendar permission needs to be renewed.",
    offline: lastRefreshed ? "Offline. Showing the last refreshed events." : "Offline. Calendar context is unavailable.",
    refreshed: lastRefreshed ? `Refreshed ${lastRefreshed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.` : "Calendar is connected.",
    conflict: "One or more Calendar events overlap a timed task.",
  }[syncState];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const value = JSON.parse(window.localStorage.getItem(CALENDAR_SELECTION_KEY) ?? "null");
        if (Array.isArray(value) && value.length && value.every((item) => typeof item === "string")) setSelected(value);
      } catch { /* Ignore malformed local selection. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectedQuery = useMemo(() => selected.join(","), [selected]);
  const refresh = useCallback(async () => {
    setLoading(true);
    const response = await integrationFetch<GoogleEvent[]>(`/api/integrations/google/events?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&calendars=${encodeURIComponent(selectedQuery)}`);
    setResult(response);
    if (response.data) { setEvents(response.data); setLastRefreshed(new Date()); }
    else if (response.status !== "offline") setEvents([]);
    setLoading(false);
  }, [end, selectedQuery, start]);

  // Provider refresh is request-backed and scoped to visible dates.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refresh(); }, [refresh]);

  async function loadCalendars() {
    const response = await integrationFetch<GoogleCalendar[]>("/api/integrations/google/calendars");
    if (response.data) setCalendars(response.data);
    else setResult(response as unknown as IntegrationResponse<GoogleEvent[]>);
  }

  function toggleCalendar(id: string) {
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    const normalized = next.length ? next : ["primary"];
    setSelected(normalized);
    localStorage.setItem(CALENDAR_SELECTION_KEY, JSON.stringify(normalized));
  }

  function applySlot(slot: CalendarSlot) {
    setStartInput(toLocalInput(slot.start));
    setEndInput(toLocalInput(slot.end));
  }

  function openCreate() {
    const task = tasks.find((item) => item.id === taskId) ?? tasks[0];
    setEditing(null); setTaskId(task?.id ?? ""); setSummary(task?.title ?? "");
    if (slots[0]) applySlot(slots[0]); else { setStartInput(start.slice(0, 16)); setEndInput(end.slice(0, 16)); }
    setDialog("create");
  }

  function openEdit(event: GoogleEvent) {
    setEditing(event); setTaskId(event.taskReference ?? ""); setSummary(event.summary);
    setStartInput(event.start.slice(0, 16)); setEndInput(event.end.slice(0, 16)); setDialog("edit");
  }

  function payload() {
    return { calendarId: selected[0] ?? "primary", taskReference: taskId, summary: summary.trim(), start: new Date(startInput).toISOString(), end: new Date(endInput).toISOString() };
  }

  async function undoCreated(event: GoogleEvent) {
    const response = await integrationFetch(`/api/integrations/google/events/${encodeURIComponent(event.id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ calendarId: event.calendarId }) });
    if (response.error) { setResult(response as unknown as IntegrationResponse<GoogleEvent[]>); return; }
    setReceipt(null); await refresh();
  }

  async function saveManagedEvent() {
    setSaving(true);
    const previous = editing;
    const input = payload();
    const response = await integrationFetch<GoogleEvent>(previous ? `/api/integrations/google/events/${encodeURIComponent(previous.id)}` : "/api/integrations/google/events/managed", { method: previous ? "PATCH" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
    setSaving(false);
    if (response.error || !response.data) { setResult(response as unknown as IntegrationResponse<GoogleEvent[]>); return; }
    const changed = response.data;
    if (previous) {
      setReceipt({ message: `Updated “${changed.summary}”.`, undo: async () => {
        const undoResponse = await integrationFetch(`/api/integrations/google/events/${encodeURIComponent(changed.id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ calendarId: previous.calendarId, taskReference: previous.taskReference, summary: previous.summary, description: previous.description, start: previous.start, end: previous.end }) });
        if (undoResponse.error) { setResult(undoResponse as unknown as IntegrationResponse<GoogleEvent[]>); return; }
        setReceipt(null); await refresh();
      } });
    } else setReceipt({ message: `Scheduled “${changed.summary}”.`, undo: () => undoCreated(changed) });
    setDialog(null); await refresh();
  }

  async function deleteManagedEvent(event: GoogleEvent) {
    const response = await integrationFetch(`/api/integrations/google/events/${encodeURIComponent(event.id)}`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ calendarId: event.calendarId }) });
    if (response.error) { setResult(response as unknown as IntegrationResponse<GoogleEvent[]>); return; }
    setReceipt({ message: `Deleted “${event.summary}”.`, undo: event.taskReference ? async () => {
      const undoResponse = await integrationFetch("/api/integrations/google/events/managed", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ calendarId: event.calendarId, taskReference: event.taskReference, summary: event.summary, description: event.description, start: event.start, end: event.end }) });
      if (undoResponse.error) { setResult(undoResponse as unknown as IntegrationResponse<GoogleEvent[]>); return; }
      setReceipt(null); await refresh();
    } : undefined });
    await refresh();
  }

  const validDraft = Boolean(summary.trim() && taskId && startInput && endInput && Date.parse(endInput) > Date.parse(startInput));
  return <section className="provider-calendar-panel" aria-labelledby="provider-calendar-heading">
    <div className="section-heading compact"><div><span className="section-kicker"><CalendarClock size={14} /> Google Calendar</span><h2 id="provider-calendar-heading">Calendar context</h2></div><div className="provider-panel-actions"><Button onClick={() => void refresh()} disabled={loading || syncState === "offline"} title="Refresh visible Calendar dates"><RefreshCw size={14} /> {loading ? "Syncing…" : "Refresh"}</Button><Button onClick={() => void loadCalendars()}>Select calendars</Button><Button variant="primary" onClick={openCreate} disabled={syncState !== "refreshed" && syncState !== "conflict" || !tasks.length}>Schedule task</Button></div></div>
    <StatusMessage tone={syncState === "sync_failed" || syncState === "permission_revoked" ? "error" : "notice"}>{syncState === "offline" ? <WifiOff size={15} /> : null}{syncCopy}</StatusMessage>
    {result?.error && syncState !== "offline" ? <StatusMessage tone="error">{result.error.message} {result.error.retryable ? <Button onClick={() => void refresh()}>Try again</Button> : null}</StatusMessage> : null}
    {receipt ? <StatusMessage><Check size={15} /> {receipt.message} {receipt.undo ? <Button onClick={() => void receipt.undo?.()}><RotateCcw size={14} /> Undo</Button> : <span>This event could not be restored automatically.</span>}</StatusMessage> : null}
    {calendars.length ? <div className="provider-selection" role="group" aria-label="Calendars used as context">{calendars.map((calendar) => <label key={calendar.id}><input type="checkbox" checked={selected.includes(calendar.id)} onChange={() => toggleCalendar(calendar.id)} />{calendar.summary}{calendar.primary ? " · primary" : ""}</label>)}</div> : null}
    <div className="provider-event-list">{events.length ? events.map((event) => <article key={`${event.calendarId}:${event.id}`} className={`provider-event ${event.rhythmManaged ? "is-managed" : "is-external"} ${conflicts[event.id]?.length ? "has-conflict" : ""}`}><div><span>{event.rhythmManaged ? "Scheduled by Rhythm" : "Calendar event · read-only"}</span><strong>{event.summary}</strong><small>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(event.start))}</small>{conflicts[event.id]?.map((title) => <p className="provider-conflict" key={title} role="status">Overlaps: {title}</p>)}</div><div className="provider-event__actions">{event.htmlLink ? <a href={event.htmlLink} target="_blank" rel="noreferrer">Open</a> : null}{event.rhythmManaged ? <><Button onClick={() => openEdit(event)}>Edit</Button><ConfirmAction label="Delete" title="Delete this Calendar block?" description="This deletes only the event Rhythm created. You can undo afterward when its task reference is available." confirmLabel="Delete event" tone="danger" onConfirm={() => deleteManagedEvent(event)} /></> : null}</div></article>) : <p className="provider-empty">{result?.status === "connected" ? "No Calendar events in these visible dates." : "Calendar context is not available yet."}</p>}</div>
    {dialog ? <Dialog open onClose={() => setDialog(null)} title={dialog === "preview" ? "Review Calendar change" : editing ? "Edit Calendar block" : "Find a time for this task"}>{dialog === "preview" ? <><p className="ui-dialog__description">Proposed action: {editing ? "update" : "create"} one Google Calendar event. No other tasks or events will change.</p><p><strong>{summary}</strong><br />{formatSlot({ start: new Date(startInput).toISOString(), end: new Date(endInput).toISOString() })}</p><div className="ui-dialog__actions"><Button onClick={() => setDialog(editing ? "edit" : "create")}>Edit</Button><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" disabled={saving} onClick={() => void saveManagedEvent()}>{saving ? "Applying…" : "Approve and apply"}</Button></div></> : <><p className="ui-dialog__description">{slots.length && !editing ? "Suggested times use only connected Calendar events in the visible dates. Choose one or enter a time." : "Choose a time, then review before anything changes."}</p>{!editing && slots.length ? <div className="provider-selection" role="group" aria-label="Suggested and alternate times">{slots.map((slot) => <button type="button" key={slot.start} onClick={() => applySlot(slot)}>{slot.label} · {formatSlot(slot)}</button>)}</div> : null}<label className="integration-field">Task<select value={taskId} onChange={(event) => { setTaskId(event.target.value); const task = tasks.find((item) => item.id === event.target.value); if (task) setSummary(task.title); }}>{tasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}</select></label><label className="integration-field">Title<input value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label className="integration-field">Starts<input type="datetime-local" value={startInput} onChange={(event) => setStartInput(event.target.value)} /></label><label className="integration-field">Ends<input type="datetime-local" value={endInput} onChange={(event) => setEndInput(event.target.value)} /></label><div className="ui-dialog__actions"><Button onClick={() => setDialog(null)}>Cancel</Button><Button variant="primary" disabled={!validDraft} onClick={() => setDialog("preview")}>Review change</Button></div></>}</Dialog> : null}
  </section>;
}
