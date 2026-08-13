"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Check, Circle, Moon, Orbit, Pause, Pencil, Play, Plus, SkipForward, Sparkles, Sun, Waves } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { Button, ConfirmAction, Dialog, EmptyState, Spinner } from "@/components/ui";
import { BarrelTimePicker } from "@/components/barrel-time-picker";
import { getNextRhythmOccurrence, toDateKey, type RhythmDefinition, type RhythmFrequency, type RhythmIntervalUnit, type RhythmWeekday, type TaskPriority } from "@/lib/rhythm";

const icons = { sun: Sun, waves: Waves, moon: Moon, orbit: Orbit };
const weekdays: Array<{ value: RhythmWeekday; label: string; short: string }> = [
  { value: 1, label: "Monday", short: "M" }, { value: 2, label: "Tuesday", short: "T" }, { value: 3, label: "Wednesday", short: "W" },
  { value: 4, label: "Thursday", short: "T" }, { value: 5, label: "Friday", short: "F" }, { value: 6, label: "Saturday", short: "S" }, { value: 0, label: "Sunday", short: "S" },
];

type RhythmForm = {
  title: string;
  note: string;
  frequency: RhythmFrequency;
  selectedWeekdays: RhythmWeekday[];
  interval: number;
  intervalUnit: RhythmIntervalUnit;
  startsOn: string;
  endsOn: string;
  localTime: string;
  project: string;
  estimateMinutes: number;
  priority: TaskPriority;
  icon: RhythmDefinition["icon"];
  tone: RhythmDefinition["tone"];
};

const defaultForm: RhythmForm = { title: "", note: "", frequency: "daily", selectedWeekdays: [1], interval: 2, intervalUnit: "day", startsOn: toDateKey(new Date()), endsOn: "", localTime: "09:00", project: "Personal", estimateMinutes: 25, priority: "medium", icon: "orbit", tone: "lime" };

function formFromRhythm(rhythm?: RhythmDefinition): RhythmForm {
  if (!rhythm) return { ...defaultForm };
  return { title: rhythm.title, note: rhythm.note, frequency: rhythm.schedule.frequency, selectedWeekdays: rhythm.schedule.weekdays ?? [1], interval: rhythm.schedule.interval ?? 2, intervalUnit: rhythm.schedule.intervalUnit ?? "day", startsOn: rhythm.startsOn, endsOn: rhythm.endsOn ?? "", localTime: rhythm.localTime ?? "", project: rhythm.project ?? "Personal", estimateMinutes: rhythm.estimateMinutes ?? 25, priority: rhythm.priority ?? "medium", icon: rhythm.icon, tone: rhythm.tone };
}

function formatTime(time?: string) {
  if (!time) return "Any time";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${time}:00`));
}

function rhythmScheduleLabel(rhythm: RhythmDefinition) {
  if (rhythm.schedule.frequency === "daily") return "Every day";
  if (rhythm.schedule.frequency === "weekdays") return "Weekdays";
  if (rhythm.schedule.frequency === "monthly") return "Monthly";
  if (rhythm.schedule.frequency === "custom") return `Every ${rhythm.schedule.interval ?? 1} ${rhythm.schedule.intervalUnit ?? "day"}${(rhythm.schedule.interval ?? 1) === 1 ? "" : "s"}`;
  const selected = new Set(rhythm.schedule.weekdays ?? []);
  const days = weekdays.filter((day) => selected.has(day.value)).map((day) => day.short).join(" · ");
  return `${rhythm.schedule.frequency === "biweekly" ? "Every other week" : "Weekly"}${days ? ` · ${days}` : ""}`;
}

function RhythmEditor({ rhythm, onClose, onSave }: { rhythm?: RhythmDefinition; onClose: () => void; onSave: (form: RhythmForm, scope: "entire" | "future", effectiveDate: string) => void }) {
  const [form, setForm] = useState(() => formFromRhythm(rhythm));
  const [scope, setScope] = useState<"entire" | "future">("entire");
  const [effectiveDate, setEffectiveDate] = useState(toDateKey(new Date()));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || ((form.frequency === "weekly" || form.frequency === "biweekly" || (form.frequency === "custom" && form.intervalUnit === "week")) && !form.selectedWeekdays.length)) return;
    onSave(form, scope, effectiveDate);
  }
  return <Dialog open onClose={onClose} title={rhythm ? "Edit rhythm" : "New rhythm"} className="rhythm-editor-dialog ron-task-editor-dialog">
    <form className="rhythm-form ron-task-editor unified-editor" onSubmit={submit}>
      <div className="editor-scroll-body">
      <div className="ron-editor-intro">
        <span>{rhythm ? "Edit this rhythm" : "Create a returning anchor"}</span>
        <label><span>Name</span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Walk before opening email" maxLength={120} required /></label>
        <label><span>Note</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Why this helps" maxLength={240} /></label>
      </div>
      <section className="ron-editor-section">
        <span className="section-kicker">Schedule</span>
        <label className="editor-field editor-field--wide"><span>Repeats</span><select value={form.frequency} onChange={(event) => setForm({ ...form, frequency: event.target.value as RhythmFrequency })}><option value="daily">Every day</option><option value="weekdays">Weekdays</option><option value="weekly">Weekly</option><option value="biweekly">Every other week</option><option value="monthly">Monthly</option><option value="custom">Custom interval</option></select></label>
      {form.frequency === "weekly" || form.frequency === "biweekly" || (form.frequency === "custom" && form.intervalUnit === "week") ? <fieldset className="weekday-picker"><legend>Days</legend><div>{weekdays.map((day) => <label key={day.value} title={day.label}><input type="checkbox" checked={form.selectedWeekdays.includes(day.value)} onChange={() => setForm({ ...form, selectedWeekdays: form.selectedWeekdays.includes(day.value) ? form.selectedWeekdays.filter((item) => item !== day.value) : [...form.selectedWeekdays, day.value] })} /><span>{day.short}</span></label>)}</div></fieldset> : null}
        {form.frequency === "custom" ? <div className="editor-grid"><label className="editor-field"><span>Every</span><input type="number" min="1" max="365" value={form.interval} onChange={(event) => setForm({ ...form, interval: Number(event.target.value) })} /></label><label className="editor-field"><span>Interval</span><select value={form.intervalUnit} onChange={(event) => setForm({ ...form, intervalUnit: event.target.value as RhythmIntervalUnit })}><option value="day">Days</option><option value="week">Weeks</option><option value="month">Months</option></select></label></div> : null}
      </section>
      <section className="ron-editor-section">
        <span className="section-kicker">Details</span>
      <div className="editor-grid">
        <label className="editor-field"><span>Starts</span><input type="date" value={form.startsOn} onChange={(event) => setForm({ ...form, startsOn: event.target.value })} required /></label>
        <label className="editor-field"><span>Ends (optional)</span><input type="date" min={form.startsOn} value={form.endsOn} onChange={(event) => setForm({ ...form, endsOn: event.target.value })} /></label>
        <label className="editor-field"><span>Project</span><input value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })} maxLength={120} /></label>
        <label className="editor-field"><span>Estimate</span><select value={form.estimateMinutes} onChange={(event) => setForm({ ...form, estimateMinutes: Number(event.target.value) })}>{[10, 15, 25, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>
        <label className="editor-field"><span>Priority</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
      </section>
      <section className="ron-editor-section rhythm-time-field"><div><span className="section-kicker">Time</span><div className="optional-time-control"><button type="button" aria-pressed={!form.localTime} onClick={() => setForm({ ...form, localTime: "" })}>Any time</button>{form.localTime ? <button type="button" onClick={() => setForm({ ...form, localTime: "" })}>Clear</button> : <button type="button" onClick={() => setForm({ ...form, localTime: "09:00" })}>Set time</button>}</div></div>{form.localTime ? <BarrelTimePicker value={form.localTime} onChange={(localTime) => setForm({ ...form, localTime })} label="Rhythm time" /> : null}</section>
      {rhythm ? <fieldset className="rhythm-frequency ron-editor-more"><legend>Apply changes to</legend><div className="segmented-control"><button type="button" className={scope === "entire" ? "is-active" : ""} aria-pressed={scope === "entire"} onClick={() => setScope("entire")}>Entire Rhythm</button><button type="button" className={scope === "future" ? "is-active" : ""} aria-pressed={scope === "future"} onClick={() => setScope("future")}>This and future</button></div>{scope === "future" ? <label className="editor-field"><span>Effective date</span><input type="date" min={rhythm.startsOn} value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} required /></label> : null}</fieldset> : null}
      </div>
      <div className="editor-actions unified-editor__actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" className="ron-save-task" disabled={!form.title.trim() || ((form.frequency === "weekly" || form.frequency === "biweekly" || (form.frequency === "custom" && form.intervalUnit === "week")) && !form.selectedWeekdays.length)}>{rhythm ? "Review changes" : "Add rhythm"}</Button></div>
    </form>
  </Dialog>;
}

export function RhythmsView() {
  const root = useRef<HTMLDivElement>(null);
  const { rhythms, rhythmCompletions, rhythmExceptions, getWorkItems, hydrated, createRhythm, updateRhythm, updateRhythmFuture, pauseRhythm, resumeRhythm, archiveRhythm, deleteRhythm, completeOccurrence, uncompleteOccurrence, skipNextOccurrence } = useRhythm();
  const [editorRhythm, setEditorRhythm] = useState<RhythmDefinition | "new" | null>(null);
  const today = toDateKey(new Date());
  const todayWork = useMemo(() => getWorkItems({ start: today, end: today }), [getWorkItems, today]);
  const activeRhythms = rhythms.filter((rhythm) => !rhythm.archived);
  const todayOccurrences = todayWork.filter((task) => task.generated);
  const done = todayOccurrences.filter((task) => task.status === "completed");
  const nextOpen = todayOccurrences.find((task) => task.status !== "completed");
  const nextOpenRhythm = activeRhythms.find((rhythm) => rhythm.id === nextOpen?.rhythmId);

  useEffect(() => {
    const orbit = root.current?.querySelector<HTMLElement>(".rhythm-orbit");
    if (!orbit || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => orbit.classList.toggle("is-visible", entry.isIntersecting), { threshold: 0.15 });
    observer.observe(orbit);
    return () => observer.disconnect();
  }, []);

  function saveRhythm(form: RhythmForm, scope: "entire" | "future", effectiveDate: string) {
    const scheduledWeekdays = form.frequency === "weekly" || form.frequency === "biweekly" || (form.frequency === "custom" && form.intervalUnit === "week");
    const next: RhythmDefinition = { id: editorRhythm && editorRhythm !== "new" ? editorRhythm.id : `rhythm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: form.title.trim(), note: form.note.trim() || "A small promise worth keeping", schedule: { frequency: form.frequency, ...(scheduledWeekdays ? { weekdays: [...new Set(form.selectedWeekdays)] } : {}), ...(form.frequency === "custom" ? { interval: form.interval, intervalUnit: form.intervalUnit } : {}) }, startsOn: form.startsOn, ...(form.endsOn ? { endsOn: form.endsOn } : {}), ...(form.localTime ? { localTime: form.localTime } : {}), project: form.project.trim() || "Personal", estimateMinutes: form.estimateMinutes, priority: form.priority, icon: form.icon, tone: form.tone, paused: editorRhythm && editorRhythm !== "new" ? editorRhythm.paused : false, archived: false };
    if (editorRhythm && editorRhythm !== "new" && scope === "future") updateRhythmFuture(editorRhythm.id, effectiveDate, next);
    else if (editorRhythm && editorRhythm !== "new") updateRhythm(editorRhythm.id, next);
    else createRhythm(next);
    setEditorRhythm(null);
  }

  if (!hydrated) return <div className="workspace-view"><div className="loading-panel"><Spinner label="Loading rhythms" /><p>Preparing Rhythms from your local workspace…</p></div></div>;

  return <div className="workspace-view rhythms-reference" ref={root}>
    <header className="workspace-header" data-workspace-reveal><div><p className="eyebrow">Repeat what restores you</p><h1>Rhythms</h1><p className="page-subtitle">Gentle structure for days that still feel human.</p></div><Button variant="primary" onClick={() => setEditorRhythm("new")}><Plus size={17} aria-hidden="true" /> New rhythm</Button></header>
    <section className="rhythm-hero" data-workspace-reveal>
      <div className="rhythm-hero__top"><span className="section-kicker">Today</span><strong>{done.length} / {todayOccurrences.length}</strong></div>
      <div className="rhythm-hero__content"><div><h2>{nextOpen?.title ?? (activeRhythms.length ? "You’re clear for now." : "Create something you want to return to.")}</h2><p>{nextOpen?.note ?? (todayOccurrences.length ? "Every anchor for today is complete." : "Nothing needs attention from your Rhythms today.")}</p></div>{nextOpen?.rhythmId && nextOpen.occurrenceDate ? <div className="rhythm-hero__actions"><span>{formatTime(nextOpen.dueTime)} · {nextOpen.estimateMinutes} min</span><Button type="button" variant="primary" onClick={() => completeOccurrence({ rhythmId: nextOpen.rhythmId!, occurrenceDate: nextOpen.occurrenceDate! })}><Check size={15} /> Done</Button><Button type="button" onClick={() => skipNextOccurrence(nextOpen.rhythmId!, nextOpen.occurrenceDate!)}>Skip</Button>{nextOpenRhythm ? <Button type="button" onClick={() => setEditorRhythm(nextOpenRhythm)}>Move</Button> : null}</div> : null}</div>
      <div className="rhythm-hero__progress"><i style={{ width: `${todayOccurrences.length ? Math.round(done.length / todayOccurrences.length * 100) : 0}%` }} /></div>
    </section>
    <section className="rhythm-layout"><div className="routine-list" data-workspace-reveal><div className="section-heading"><div><span className="section-kicker">Your anchors</span><h2>Move through the day</h2></div><span>{activeRhythms.length} active</span></div>
      {activeRhythms.map((rhythm) => { const Icon = icons[rhythm.icon] ?? Orbit; const occurrence = todayOccurrences.find((task) => task.rhythmId === rhythm.id); const complete = occurrence?.status === "completed"; const nextDate = getNextRhythmOccurrence(rhythm); const completionCount = rhythmCompletions.filter((item) => item.rhythmId === rhythm.id).length; const exceptionCount = rhythmExceptions.filter((item) => item.rhythmId === rhythm.id).length; return <article className={`routine-card tone-${rhythm.tone} ${complete ? "is-complete" : ""} ${rhythm.paused ? "is-paused" : ""}`} key={rhythm.id}><span className="routine-icon"><Icon size={19} /></span><div><small>{formatTime(rhythm.localTime)} · {rhythmScheduleLabel(rhythm)}</small><h3>{rhythm.title}</h3><p>{rhythm.note}</p><span className="routine-provenance">{rhythm.project ?? "Personal"} · {rhythm.estimateMinutes ?? 25} min{rhythm.endsOn ? ` · through ${rhythm.endsOn}` : ""}</span>{completionCount || exceptionCount ? <small>History · {completionCount} completed · {exceptionCount} exception{exceptionCount === 1 ? "" : "s"}</small> : null}</div><div className="routine-actions"><Button type="button" variant="ghost" iconOnly aria-label={`Edit ${rhythm.title}`} onClick={() => setEditorRhythm(rhythm)}><Pencil size={17} aria-hidden="true" /></Button><Button type="button" variant="ghost" iconOnly aria-label={rhythm.paused ? `Resume ${rhythm.title}` : `Pause ${rhythm.title}`} onClick={() => rhythm.paused ? resumeRhythm(rhythm.id) : pauseRhythm(rhythm.id)}>{rhythm.paused ? <Play size={17} fill="currentColor" aria-hidden="true" /> : <Pause size={17} fill="currentColor" aria-hidden="true" />}</Button><Button type="button" variant="ghost" iconOnly disabled={!occurrence} aria-label={`${complete ? "Undo" : "Complete"} ${rhythm.title}`} onClick={() => occurrence?.rhythmId && occurrence.occurrenceDate ? (complete ? uncompleteOccurrence : completeOccurrence)({ rhythmId: occurrence.rhythmId, occurrenceDate: occurrence.occurrenceDate }) : undefined}>{complete ? <Check size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}</Button></div><div className="routine-secondary-actions"><Button type="button" disabled={!nextDate} onClick={() => nextDate && skipNextOccurrence(rhythm.id, nextDate)}><SkipForward size={15} aria-hidden="true" /> Skip next</Button><ConfirmAction label="Archive" title={`Archive “${rhythm.title}”?`} description="This pauses only this rhythm. Existing occurrence history stays available, and you can undo the change globally." confirmLabel="Archive rhythm" onConfirm={() => archiveRhythm(rhythm.id)} /><ConfirmAction label="Delete" title={`Delete “${rhythm.title}”?`} description="This permanently removes only this rhythm definition and its local occurrence history. The global Undo will restore it." confirmLabel="Delete rhythm" tone="danger" onConfirm={() => deleteRhythm(rhythm.id)} /></div></article>; })}
      {!activeRhythms.length ? <EmptyState title="No active rhythms yet" description="Add one gentle anchor. It will appear as local work on the right day, without changing your task list." action={<Button variant="primary" onClick={() => setEditorRhythm("new")}><Plus size={16} /> Add your first rhythm</Button>} /> : null}
      {rhythms.some((rhythm) => rhythm.archived) ? <details className="archived-rhythms"><summary><Archive size={15} /> Archived <span>{rhythms.filter((rhythm) => rhythm.archived).length}</span></summary>{rhythms.filter((rhythm) => rhythm.archived).map((rhythm) => <div key={rhythm.id}><span>{rhythm.title}</span><Button type="button" onClick={() => resumeRhythm(rhythm.id)}>Restore</Button></div>)}</details> : null}
    </div><aside className="rhythm-insight" data-workspace-reveal><span className="section-kicker"><Sparkles size={14} /> Quiet context</span><h2>{todayOccurrences.length ? "Your Rhythms are here when their day arrives." : "Nothing needs attention from your Rhythms today."}</h2><p>Pause, skip, or change one occurrence without rewriting the whole Rhythm.</p></aside></section>
    {editorRhythm ? <RhythmEditor rhythm={editorRhythm === "new" ? undefined : editorRhythm} onClose={() => setEditorRhythm(null)} onSave={saveRhythm} /> : null}
  </div>;
}
