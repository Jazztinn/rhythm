"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Archive, Check, Flame, Moon, Orbit, Pencil, Plus, Sparkles, Sun, Waves } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { Button, ConfirmAction, Dialog, EmptyState, Spinner } from "@/components/ui";
import { getNextRhythmOccurrence, toDateKey, type RhythmDefinition, type RhythmFrequency, type RhythmWeekday, type TaskPriority } from "@/lib/rhythm";

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
  localTime: string;
  project: string;
  estimateMinutes: number;
  priority: TaskPriority;
  icon: RhythmDefinition["icon"];
  tone: RhythmDefinition["tone"];
};

const defaultForm: RhythmForm = { title: "", note: "", frequency: "daily", selectedWeekdays: [1], localTime: "09:00", project: "Personal", estimateMinutes: 25, priority: "medium", icon: "orbit", tone: "lime" };

function formFromRhythm(rhythm?: RhythmDefinition): RhythmForm {
  if (!rhythm) return { ...defaultForm };
  return { title: rhythm.title, note: rhythm.note, frequency: rhythm.schedule.frequency, selectedWeekdays: rhythm.schedule.weekdays ?? [1], localTime: rhythm.localTime ?? "", project: rhythm.project ?? "Personal", estimateMinutes: rhythm.estimateMinutes ?? 25, priority: rhythm.priority ?? "medium", icon: rhythm.icon, tone: rhythm.tone };
}

function formatTime(time?: string) {
  if (!time) return "Any time";
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${time}:00`));
}

function rhythmScheduleLabel(rhythm: RhythmDefinition) {
  if (rhythm.schedule.frequency === "daily") return "Every day";
  const selected = new Set(rhythm.schedule.weekdays ?? []);
  return weekdays.filter((day) => selected.has(day.value)).map((day) => day.short).join(" · ") || "Weekly";
}

function RhythmEditor({ rhythm, onClose, onSave }: { rhythm?: RhythmDefinition; onClose: () => void; onSave: (form: RhythmForm) => void }) {
  const [form, setForm] = useState(() => formFromRhythm(rhythm));
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.title.trim() || (form.frequency === "weekly" && !form.selectedWeekdays.length)) return;
    onSave(form);
  }
  return <Dialog open onClose={onClose} title={rhythm ? "Edit rhythm" : "New rhythm"} className="rhythm-editor-dialog">
    <form className="rhythm-form" onSubmit={submit}>
      <div className="editor-heading"><div><span className="section-kicker">{rhythm ? "Edit rhythm" : "New rhythm"}</span><h2>{rhythm ? "Keep the shape that works." : "What should return?"}</h2></div></div>
      <label className="editor-field editor-field--wide"><span>Name</span><input autoFocus value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Walk before opening email" maxLength={120} required /></label>
      <label className="editor-field editor-field--wide"><span>Note</span><textarea value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Why this helps" maxLength={240} /></label>
      <fieldset className="rhythm-frequency"><legend>Repeats</legend><div className="segmented-control">{(["daily", "weekly"] as RhythmFrequency[]).map((frequency) => <button type="button" key={frequency} className={form.frequency === frequency ? "is-active" : ""} aria-pressed={form.frequency === frequency} onClick={() => setForm({ ...form, frequency })}>{frequency === "daily" ? "Every day" : "Selected days"}</button>)}</div></fieldset>
      {form.frequency === "weekly" ? <fieldset className="weekday-picker"><legend>Days</legend><div>{weekdays.map((day) => <label key={day.value} title={day.label}><input type="checkbox" checked={form.selectedWeekdays.includes(day.value)} onChange={() => setForm({ ...form, selectedWeekdays: form.selectedWeekdays.includes(day.value) ? form.selectedWeekdays.filter((item) => item !== day.value) : [...form.selectedWeekdays, day.value] })} /><span>{day.short}</span></label>)}</div></fieldset> : null}
      <div className="editor-grid">
        <label className="editor-field"><span>Time (optional)</span><input type="time" value={form.localTime} onChange={(event) => setForm({ ...form, localTime: event.target.value })} /></label>
        <label className="editor-field"><span>Project</span><input value={form.project} onChange={(event) => setForm({ ...form, project: event.target.value })} maxLength={120} /></label>
        <label className="editor-field"><span>Estimate</span><select value={form.estimateMinutes} onChange={(event) => setForm({ ...form, estimateMinutes: Number(event.target.value) })}>{[10, 15, 25, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}</select></label>
        <label className="editor-field"><span>Priority</span><select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as TaskPriority })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
      <div className="editor-actions"><Button type="button" onClick={onClose}>Cancel</Button><Button type="submit" variant="primary" disabled={!form.title.trim() || (form.frequency === "weekly" && !form.selectedWeekdays.length)}>{rhythm ? "Save changes" : "Add rhythm"}</Button></div>
    </form>
  </Dialog>;
}

export function RhythmsView() {
  const root = useRef<HTMLDivElement>(null);
  const { rhythms, getWorkItems, hydrated, createRhythm, updateRhythm, pauseRhythm, resumeRhythm, archiveRhythm, deleteRhythm, completeOccurrence, uncompleteOccurrence, skipNextOccurrence } = useRhythm();
  const [editorRhythm, setEditorRhythm] = useState<RhythmDefinition | "new" | null>(null);
  const today = toDateKey(new Date());
  const todayWork = useMemo(() => getWorkItems({ start: today, end: today }), [getWorkItems, today]);
  const activeRhythms = rhythms.filter((rhythm) => !rhythm.archived);
  const done = todayWork.filter((task) => task.generated && task.status === "completed");
  const score = activeRhythms.length ? Math.round((done.length / activeRhythms.length) * 100) : 100;

  useEffect(() => {
    const orbit = root.current?.querySelector<HTMLElement>(".rhythm-orbit");
    if (!orbit || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(([entry]) => orbit.classList.toggle("is-visible", entry.isIntersecting), { threshold: 0.15 });
    observer.observe(orbit);
    return () => observer.disconnect();
  }, []);

  function saveRhythm(form: RhythmForm) {
    const next: RhythmDefinition = { id: editorRhythm && editorRhythm !== "new" ? editorRhythm.id : `rhythm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, title: form.title.trim(), note: form.note.trim() || "A small promise worth keeping", schedule: { frequency: form.frequency, ...(form.frequency === "weekly" ? { weekdays: [...new Set(form.selectedWeekdays)] } : {}) }, startsOn: editorRhythm && editorRhythm !== "new" ? editorRhythm.startsOn : toDateKey(new Date()), ...(form.localTime ? { localTime: form.localTime } : {}), project: form.project.trim() || "Personal", estimateMinutes: form.estimateMinutes, priority: form.priority, icon: form.icon, tone: form.tone, paused: editorRhythm && editorRhythm !== "new" ? editorRhythm.paused : false, archived: false };
    if (editorRhythm && editorRhythm !== "new") updateRhythm(editorRhythm.id, next);
    else createRhythm(next);
    setEditorRhythm(null);
  }

  if (!hydrated) return <div className="workspace-view"><div className="loading-panel"><Spinner label="Loading rhythms" /><p>Preparing Rhythms from your local workspace…</p></div></div>;

  return <div className="workspace-view" ref={root}>
    <header className="workspace-header" data-workspace-reveal><div><p className="eyebrow">Repeat what restores you</p><h1>Rhythms</h1><p className="page-subtitle">Gentle structure for days that still feel human.</p></div><Button variant="primary" onClick={() => setEditorRhythm("new")}><Plus size={17} aria-hidden="true" /> New rhythm</Button></header>
    <section className="rhythm-hero" data-workspace-reveal><div className="rhythm-orbit" aria-hidden="true"><span className="rhythm-orbit-ring"><i /><i /><i /></span><strong>{score}<small>%</small></strong></div><div><span className="section-kicker"><Orbit size={15} /> Today&apos;s flow</span><h2>{activeRhythms.length === 0 ? "No active rhythms yet." : done.length === activeRhythms.length ? "All active rhythms are complete." : "A factual view of today&apos;s rhythm."}</h2><p>{done.length} of {activeRhythms.length} active rhythms complete. Tomorrow starts fresh automatically.</p><div className="streak"><Flame size={18} /><strong>{done.length ? `${done.length} anchor${done.length === 1 ? "" : "s"} complete today` : "No completed anchors yet"}</strong><span>{score}% complete</span></div></div></section>
    <section className="rhythm-layout"><div className="routine-list" data-workspace-reveal><div className="section-heading"><div><span className="section-kicker">Your anchors</span><h2>Move through the day</h2></div><span>{activeRhythms.length} active</span></div>
      {activeRhythms.map((rhythm) => { const Icon = icons[rhythm.icon] ?? Orbit; const occurrence = todayWork.find((task) => task.generated && task.rhythmId === rhythm.id); const complete = occurrence?.status === "completed"; const nextDate = getNextRhythmOccurrence(rhythm); return <article className={`routine-card tone-${rhythm.tone} ${complete ? "is-complete" : ""} ${rhythm.paused ? "is-paused" : ""}`} key={rhythm.id}><span className="routine-icon"><Icon size={19} /></span><div><small>{formatTime(rhythm.localTime)} · {rhythmScheduleLabel(rhythm)}</small><h3>{rhythm.title}</h3><p>{rhythm.note}</p><span className="routine-provenance">{rhythm.project ?? "Personal"} · {rhythm.estimateMinutes ?? 25} min · {rhythm.priority ?? "medium"}</span></div><div className="routine-actions"><Button type="button" variant="ghost" iconOnly aria-label={`Edit ${rhythm.title}`} onClick={() => setEditorRhythm(rhythm)}><Pencil size={14} aria-hidden="true" /></Button><Button type="button" variant="ghost" iconOnly aria-label={rhythm.paused ? `Resume ${rhythm.title}` : `Pause ${rhythm.title}`} onClick={() => rhythm.paused ? resumeRhythm(rhythm.id) : pauseRhythm(rhythm.id)}>{rhythm.paused ? <span>▶</span> : <span>Ⅱ</span>}</Button><Button type="button" variant="ghost" iconOnly aria-label={`${complete ? "Undo" : "Complete"} ${rhythm.title}`} onClick={() => occurrence?.rhythmId && occurrence.occurrenceDate ? (complete ? uncompleteOccurrence : completeOccurrence)({ rhythmId: occurrence.rhythmId, occurrenceDate: occurrence.occurrenceDate }) : undefined}>{complete ? <Check size={17} aria-hidden="true" /> : <span />}</Button></div><div className="routine-secondary-actions"><Button type="button" onClick={() => nextDate && skipNextOccurrence(rhythm.id, nextDate)}><SkipForwardIcon /> Skip next</Button><ConfirmAction label="Archive" title={`Archive “${rhythm.title}”?`} description="This pauses only this rhythm. Existing occurrence history stays available, and you can undo the change globally." confirmLabel="Archive rhythm" onConfirm={() => archiveRhythm(rhythm.id)} /><ConfirmAction label="Delete" title={`Delete “${rhythm.title}”?`} description="This permanently removes only this rhythm definition and its local occurrence history. The global Undo will restore it." confirmLabel="Delete rhythm" tone="danger" onConfirm={() => deleteRhythm(rhythm.id)} /></div></article>; })}
      {!activeRhythms.length ? <EmptyState title="No active rhythms yet" description="Add one gentle anchor. It will appear as local work on the right day, without changing your task list." action={<Button variant="primary" onClick={() => setEditorRhythm("new")}><Plus size={16} /> Add your first rhythm</Button>} /> : null}
      {rhythms.some((rhythm) => rhythm.archived) ? <details className="archived-rhythms"><summary><Archive size={15} /> Archived <span>{rhythms.filter((rhythm) => rhythm.archived).length}</span></summary>{rhythms.filter((rhythm) => rhythm.archived).map((rhythm) => <div key={rhythm.id}><span>{rhythm.title}</span><Button type="button" onClick={() => resumeRhythm(rhythm.id)}>Restore</Button></div>)}</details> : null}
    </div><aside className="rhythm-insight" data-workspace-reveal><span className="section-kicker"><Sparkles size={14} /> Local summary</span><h2>{done.length ? "Completed anchors stay visible in this workspace." : "No anchors are complete today."}</h2><p>{done.length ? `${done.length} complete today. Rhythm measures this device only.` : "Your rhythm definitions stay until you change them. Generated work remains local and reversible."}</p><div className="insight-chart">{activeRhythms.slice(0, 7).map((rhythm) => <span key={rhythm.id}><i style={{ height: done.some((task) => task.rhythmId === rhythm.id) ? "88%" : "28%" }} /><small>{rhythm.localTime?.slice(0, 2) ?? "—"}</small></span>)}</div></aside></section>
    {editorRhythm ? <RhythmEditor rhythm={editorRhythm === "new" ? undefined : editorRhythm} onClose={() => setEditorRhythm(null)} onSave={saveRhythm} /> : null}
  </div>;
}

function SkipForwardIcon() {
  return <span aria-hidden="true">→</span>;
}
