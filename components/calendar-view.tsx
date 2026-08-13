"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, GripHorizontal, Plus, Sparkles, WandSparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { OccurrenceActionSheet } from "@/components/occurrence-action-sheet";
import { GoogleCalendarPanel } from "@/components/google-calendar-panel";
import { TaskEditor } from "@/components/task-editor";
import { addDays, dateRangeFrom, resolveTaskDate, toDateKey, type Task, type TaskDraft } from "@/lib/rhythm";

const START_HOUR = 8;
const END_HOUR = 23;
const SLOT_MINUTES = 15;
const SLOT_HEIGHT = 26;
const SLOT_COUNT = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;
const slots = Array.from({ length: SLOT_COUNT }, (_, index) => index);
const tones = { high: "peach", medium: "green", low: "violet" } as const;

function startOfWeek(date: Date) {
  const start = new Date(date);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  start.setHours(12, 0, 0, 0);
  return start;
}

function dateFromKey(key: string, time = "12:00") {
  return new Date(`${key}T${time || "12:00"}:00`);
}

function weekLabel(start: Date) {
  const end = addDays(start, 6);
  const first = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(start);
  const last = new Intl.DateTimeFormat("en-US", { month: start.getMonth() === end.getMonth() ? undefined : "short", day: "numeric", year: end.getFullYear() !== start.getFullYear() ? "numeric" : undefined }).format(end);
  return `${first}–${last}`;
}

function taskDate(task: Task, now: Date) {
  const key = resolveTaskDate(task, now);
  return key ? dateFromKey(key, task.dueTime || "23:59") : null;
}

function taskDraft(task: Task, changes: Partial<TaskDraft> = {}): TaskDraft {
  return {
    title: task.title,
    project: task.project,
    dueDate: resolveTaskDate(task) ?? "",
    dueTime: task.dueTime ?? "",
    estimateMinutes: task.estimateMinutes,
    priority: task.priority,
    later: task.later,
    note: task.note,
    ...changes,
  };
}

function timeForSlot(slot: number) {
  const minutes = START_HOUR * 60 + slot * SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function slotForTime(time?: string) {
  if (!time) return 16;
  const [hour, minute] = time.split(":").map(Number);
  return Math.max(0, Math.min(SLOT_COUNT - 1, Math.round(((hour - START_HOUR) * 60 + minute) / SLOT_MINUTES)));
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

type EventCardProps = {
  task: Task;
  day: number;
  onOpen: (task: Task) => void;
  onComplete: (task: Task) => void;
  onResize: (task: Task, minutes: number) => void;
};

function EventCard({ task, day, onOpen, onComplete, onResize }: EventCardProps) {
  const startSlot = slotForTime(task.dueTime);
  const [liveMinutes, setLiveMinutes] = useState(task.estimateMinutes);
  const resizing = useRef(false);

  function beginResize(event: React.PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    resizing.current = true;
    const startY = event.clientY;
    const startMinutes = liveMinutes;
    event.currentTarget.setPointerCapture(event.pointerId);
    const target = event.currentTarget;
    const move = (moveEvent: PointerEvent) => {
      const deltaSlots = Math.round((moveEvent.clientY - startY) / SLOT_HEIGHT);
      setLiveMinutes(Math.max(15, Math.min(480, startMinutes + deltaSlots * SLOT_MINUTES)));
    };
    const finish = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", finish);
      target.removeEventListener("pointercancel", finish);
      resizing.current = false;
      setLiveMinutes((minutes) => { onResize(task, minutes); return minutes; });
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", finish, { once: true });
    target.addEventListener("pointercancel", finish, { once: true });
  }

  return <article
    className={`direct-calendar-event tone-${tones[task.priority]} ${liveMinutes <= 30 ? "is-compact" : ""} ${task.status === "completed" ? "is-done" : ""}`}
    style={{ gridColumn: day + 2, gridRow: `${startSlot + 2} / span ${Math.max(2, Math.round(liveMinutes / SLOT_MINUTES))}` }}
    draggable={!task.status || task.status === "pending"}
    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/rhythm-task", task.id); }}
    onClick={() => { if (!resizing.current) onOpen(task); }}
    onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen(task); } }}
    role="button"
    tabIndex={0}
    aria-label={`${task.title}, ${task.dueTime ?? "flexible"}, ${formatDuration(task.estimateMinutes)}. Open details.`}
  >
    <small>{task.generated ? "From Rhythm · " : ""}{task.dueTime ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(dateFromKey(resolveTaskDate(task)!, task.dueTime)) : "Flexible"}</small>
    <strong>{task.title}</strong>
    <span>{formatDuration(liveMinutes)} · {task.project}</span>
    <button className="event-quick-complete" type="button" aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`} onClick={(event) => { event.stopPropagation(); onComplete(task); }}><Check size={13} /></button>
    <button className="event-resize-handle" type="button" aria-label={`Resize ${task.title}. Use editor for keyboard duration changes.`} onPointerDown={beginResize}><GripHorizontal size={15} /></button>
  </article>;
}

export function CalendarView() {
  const calendarPanel = useRef<HTMLElement>(null);
  const { getWorkItems, createTask, updateTask, toggleTask, completeOccurrence, uncompleteOccurrence, skipOccurrence, rescheduleOccurrence, editOccurrence } = useRhythm();
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(() => new Date(1704110400000));
  const [selectedDate, setSelectedDate] = useState(() => toDateKey(new Date(1704110400000)));
  const [occurrenceTask, setOccurrenceTask] = useState<Task | null>(null);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [newTaskSeed, setNewTaskSeed] = useState<Partial<TaskDraft> | null>(null);
  const [suggestionVisible, setSuggestionVisible] = useState(true);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<{ day: number; start: number; end: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { const current = new Date(); setNow(current); setSelectedDate(toDateKey(current)); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const weekStart = useMemo(() => addDays(startOfWeek(now), weekOffset * 7), [now, weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const workItems = useMemo(() => getWorkItems(dateRangeFrom(weekStart, 0, 6)), [getWorkItems, weekStart]);
  const weekTasks = useMemo(() => {
    const keys = new Set(days.map(toDateKey));
    return workItems.filter((task) => { const key = resolveTaskDate(task, now); return key !== null && keys.has(key); });
  }, [days, now, workItems]);
  const scheduled = weekTasks.filter((task) => task.dueTime);
  const unscheduled = workItems.filter((task) => task.status === "pending" && (!resolveTaskDate(task, now) || !task.dueTime));
  const plannedMinutes = weekTasks.filter((task) => task.status === "pending").reduce((sum, task) => sum + task.estimateMinutes, 0);
  const upcoming = workItems.filter((task) => task.status === "pending").map((task) => ({ task, date: taskDate(task, now) })).filter((item): item is { task: Task; date: Date } => item.date !== null && item.date.getTime() >= now.getTime()).sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const suggestionTask = weekTasks.find((task) => task.generated && task.status === "pending" && /close the loops/i.test(task.title)) ?? weekTasks.find((task) => task.generated && task.status === "pending");

  function moveTask(task: Task, date: string, time: string) {
    if (task.generated && task.rhythmId && task.occurrenceDate) rescheduleOccurrence({ rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate }, date, time);
    else updateTask(task.id, taskDraft(task, { dueDate: date, dueTime: time, later: false }));
  }

  function resizeTask(task: Task, minutes: number) {
    if (minutes === task.estimateMinutes) return;
    if (task.generated && task.rhythmId && task.occurrenceDate) editOccurrence({ rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate }, { estimateMinutes: minutes });
    else updateTask(task.id, taskDraft(task, { estimateMinutes: minutes }));
  }

  function completeTask(task: Task) {
    if (task.generated && task.rhythmId && task.occurrenceDate) {
      const occurrence = { rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate };
      if (task.status === "completed") uncompleteOccurrence(occurrence); else completeOccurrence(occurrence);
    } else toggleTask(task.id);
  }

  function openTask(task: Task) {
    if (task.generated) setOccurrenceTask(task); else setEditorTask(task);
  }

  function openCreate(dayIndex: number, startSlot: number, duration = 30) {
    setNewTaskSeed({ dueDate: toDateKey(days[dayIndex]), dueTime: timeForSlot(startSlot), estimateMinutes: duration, later: false, project: "Personal", priority: "medium" });
  }

  function jumpTo(date: Date) {
    const target = startOfWeek(date);
    const current = startOfWeek(now);
    setWeekOffset(Math.round((target.getTime() - current.getTime()) / (7 * 86_400_000)));
    setSelectedDate(toDateKey(date));
  }

  const shortcutDates = {
    today: now,
    tomorrow: addDays(now, 1),
    friday: addDays(now, (5 - now.getDay() + 7) % 7 || 7),
    weekend: addDays(now, (6 - now.getDay() + 7) % 7 || 7),
  };

  return <div className="workspace-view calendar-workspace calendar-direct">
    <header className="workspace-header calendar-direct__header" data-workspace-reveal>
      <div><p className="eyebrow">Your time, at a glance</p><h1>Calendar</h1><p className="page-subtitle">Drag to schedule. Draw on open time. Resize duration directly.</p></div>
      <span className="weather"><CalendarDays size={15} /> Local task view</span>
    </header>

    {suggestionVisible && suggestionTask ? <section className="calendar-smart-banner" aria-label="Smart scheduling suggestion">
      <span className="calendar-smart-icon"><WandSparkles size={16} /></span>
      <div><strong>Smart pattern detected</strong><p>You often complete “{suggestionTask.title}” around 8:30 PM.</p></div>
      <div><button type="button" onClick={() => { moveTask(suggestionTask, resolveTaskDate(suggestionTask, now)!, "20:30"); setSuggestionVisible(false); }}>Apply 8:30 PM slot</button><button type="button" onClick={() => setSuggestionVisible(false)}>Keep observing</button></div>
    </section> : null}

    <section className="calendar-summary" data-workspace-reveal>
      <article className="availability-card"><div><span className="section-kicker"><Sparkles size={14} /> Dated task minutes</span><h2>{plannedMinutes ? `${Math.floor(plannedMinutes / 60)}h ${plannedMinutes % 60}m planned.` : "No dated tasks yet."}</h2><p>Based on dated tasks only; {weekTasks.length} task{weekTasks.length === 1 ? "" : "s"}. Rhythm calculates time from your schedule.</p></div></article>
      <article className="next-event-card" role={upcoming ? "button" : undefined} tabIndex={upcoming ? 0 : undefined} onClick={() => upcoming && openTask(upcoming.task)} onKeyDown={(event) => { if (upcoming && (event.key === "Enter" || event.key === " ")) openTask(upcoming.task); }}><span className="section-kicker"><Clock3 size={14} /> Up next</span><strong>{upcoming?.task.title ?? "Nothing scheduled"}</strong><p>{upcoming ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(upcoming.date) : "Add a date and time from Tasks."}</p><div><i /> {upcoming ? `${upcoming.task.estimateMinutes} min · ${upcoming.task.project}` : "Your calendar is clear"}</div></article>
    </section>

    <section className="calendar-panel direct-calendar-panel" data-workspace-reveal ref={calendarPanel}>
      <div className="direct-calendar-toolbar">
        <div><button aria-label="Previous week" onClick={() => { setWeekOffset((value) => value - 1); setSelectedDate(""); }}><ArrowLeft size={16} /></button><h2>{weekLabel(weekStart)}</h2><button aria-label="Next week" onClick={() => { setWeekOffset((value) => value + 1); setSelectedDate(""); }}><ArrowRight size={16} /></button></div>
        <div className="calendar-date-shortcuts" aria-label="Jump to date">{Object.entries(shortcutDates).map(([label, date]) => <button key={label} className={selectedDate === toDateKey(date) ? "is-selected" : ""} aria-pressed={selectedDate === toDateKey(date)} onClick={() => jumpTo(date)}>{label === "today" ? "Today" : label === "tomorrow" ? "Tomorrow" : label === "friday" ? "Friday" : "Weekend"}</button>)}</div>
        <button className="calendar-create-button" onClick={() => openCreate(Math.max(0, days.findIndex((day) => toDateKey(day) === toDateKey(now))), slotForTime(`${String(now.getHours()).padStart(2, "0")}:${String(Math.floor(now.getMinutes() / 15) * 15).padStart(2, "0")}`))}><Plus size={14} /> New task</button>
      </div>
      <p className="direct-calendar-tip">Tip: drag across open grid space to create. Keyboard users can focus any slot and press Enter.</p>
      <div className="direct-calendar-scroll">
        <div className="direct-calendar-grid" style={{ "--calendar-slot-height": `${SLOT_HEIGHT}px` } as React.CSSProperties}>
          <div className="direct-calendar-corner"><Clock3 size={15} /></div>
          {days.map((day) => <div className={`direct-calendar-day ${toDateKey(day) === selectedDate ? "is-active" : ""}`} key={toDateKey(day)}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}</span><strong>{day.getDate()}</strong></div>)}
          {slots.filter((slot) => slot % 4 === 0).map((slot) => <div className="direct-calendar-time" key={slot} style={{ gridRow: `${slot + 2} / span 4` }}><span>{new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(dateFromKey("2026-01-01", timeForSlot(slot)))}</span></div>)}
          {days.flatMap((day, dayIndex) => slots.map((slot) => {
            const key = `${dayIndex}-${slot}`;
            const selected = drawing?.day === dayIndex && slot >= Math.min(drawing.start, drawing.end) && slot <= Math.max(drawing.start, drawing.end);
            const selectionStart = drawing ? Math.min(drawing.start, drawing.end) : slot;
            const selectionEnd = drawing ? Math.max(drawing.start, drawing.end) : slot;
            const selectionMiddle = Math.floor((selectionStart + selectionEnd) / 2);
            const selectionRadius = Math.max(1, (selectionEnd - selectionStart) / 2);
            const selectionStrength = selected ? 0.22 + 0.7 * (1 - Math.min(1, Math.abs(slot - (selectionStart + selectionEnd) / 2) / selectionRadius)) : 0;
            return <button
              type="button"
              className={`direct-calendar-cell ${dragTarget === key ? "is-drop-target" : ""} ${selected ? "is-drawing" : ""}`}
              key={key}
              style={{ gridColumn: dayIndex + 2, gridRow: slot + 2, "--selection-strength": selectionStrength } as React.CSSProperties}
              aria-label={`Create task ${new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" }).format(day)} at ${new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(dateFromKey(toDateKey(day), timeForSlot(slot)))}`}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); openCreate(dayIndex, slot); } }}
              onPointerDown={(event) => {
                if (event.pointerType === "mouse" && event.button !== 0) return;
                const target = event.currentTarget;
                const startY = event.clientY;
                setDrawing({ day: dayIndex, start: slot, end: slot });
                target.setPointerCapture(event.pointerId);
                const move = (moveEvent: PointerEvent) => setDrawing({ day: dayIndex, start: slot, end: Math.max(slot, Math.min(SLOT_COUNT - 1, slot + Math.round((moveEvent.clientY - startY) / SLOT_HEIGHT))) });
                const finish = (upEvent: PointerEvent) => {
                  target.removeEventListener("pointermove", move);
                  target.removeEventListener("pointerup", finish);
                  target.removeEventListener("pointercancel", cancel);
                  const end = Math.max(slot, Math.min(SLOT_COUNT - 1, slot + Math.round((upEvent.clientY - startY) / SLOT_HEIGHT)));
                  setDrawing(null);
                  openCreate(dayIndex, slot, Math.abs(upEvent.clientY - startY) >= 8 ? Math.max(15, (end - slot + 1) * SLOT_MINUTES) : 30);
                };
                const cancel = () => { target.removeEventListener("pointermove", move); target.removeEventListener("pointerup", finish); setDrawing(null); };
                target.addEventListener("pointermove", move);
                target.addEventListener("pointerup", finish, { once: true });
                target.addEventListener("pointercancel", cancel, { once: true });
              }}
              onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; setDragTarget(key); }}
              onDragLeave={() => setDragTarget((current) => current === key ? null : current)}
              onDrop={(event) => { event.preventDefault(); const id = event.dataTransfer.getData("application/rhythm-task"); const task = workItems.find((item) => item.id === id); if (task) moveTask(task, toDateKey(day), timeForSlot(slot)); setDragTarget(null); }}
            >{selected && slot === selectionMiddle ? <span>{formatDuration((selectionEnd - selectionStart + 1) * SLOT_MINUTES)}</span> : null}</button>;
          }))}
          {scheduled.map((task) => { const key = resolveTaskDate(task, now); const day = days.findIndex((date) => toDateKey(date) === key); return day >= 0 ? <EventCard key={task.id} task={task} day={day} onOpen={openTask} onComplete={completeTask} onResize={resizeTask} /> : null; })}
        </div>
      </div>
    </section>

    <section className="calendar-agenda-mobile" aria-label="Week agenda">
      <div className="section-heading compact"><div><span className="section-kicker"><CalendarDays size={14} /> Agenda</span><h2>This week</h2></div><span>{weekTasks.length} local task{weekTasks.length === 1 ? "" : "s"}</span></div>
      <div className="calendar-agenda-days">{days.map((day) => { const key = toDateKey(day); const tasks = weekTasks.filter((task) => resolveTaskDate(task, now) === key).sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99")); return <section key={key} className="calendar-agenda-day"><h3><span>{new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(day)}</span><time dateTime={key}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(day)}</time></h3>{tasks.length ? tasks.map((task) => <button type="button" key={task.id} onClick={() => openTask(task)}><time>{task.dueTime ?? "Flexible"}</time><span><strong>{task.title}</strong><small>{task.generated ? "Rhythm occurrence · " : ""}{task.estimateMinutes} min{task.status === "completed" ? " · Complete" : ""}</small></span></button>) : <p>No local tasks.</p>}</section>; })}</div>
    </section>

    <GoogleCalendarPanel start={dateFromKey(toDateKey(days[0]), "00:00").toISOString()} end={dateFromKey(toDateKey(addDays(days[6], 1)), "00:00").toISOString()} tasks={weekTasks} />

    {unscheduled.length ? <aside className="calendar-task-strip direct-task-strip"><span>I need a time · drag to schedule</span>{unscheduled.slice(0, 6).map((task) => <article key={task.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/rhythm-task", task.id); }} tabIndex={0} onClick={() => openTask(task)} onKeyDown={(event) => { if (event.key === "Enter") openTask(task); }}><i className={`tone-${tones[task.priority]}`} /><div><strong>{task.title}</strong><small>{task.generated ? "From Rhythm · " : ""}{task.estimateMinutes} min · {task.project}</small></div></article>)}</aside> : null}

    {editorTask ? <TaskEditor task={editorTask} onClose={() => setEditorTask(null)} onSave={(draft) => { updateTask(editorTask.id, draft); setEditorTask(null); }} /> : null}
    {newTaskSeed ? <TaskEditor initialDraft={newTaskSeed} onClose={() => setNewTaskSeed(null)} onSave={(draft) => { createTask(draft); setNewTaskSeed(null); }} /> : null}
    {occurrenceTask?.rhythmId && occurrenceTask.occurrenceDate ? <OccurrenceActionSheet task={occurrenceTask} onClose={() => setOccurrenceTask(null)} onComplete={() => { completeOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onUncomplete={() => { uncompleteOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onSkip={() => { skipOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onReschedule={(date, time) => { rescheduleOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }, date, time); setOccurrenceTask(null); }} /> : null}
  </div>;
}
