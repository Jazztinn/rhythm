"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Sparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { OccurrenceActionSheet } from "@/components/occurrence-action-sheet";
import { GoogleCalendarPanel } from "@/components/google-calendar-panel";
import { addDays, dateRangeFrom, resolveTaskDate, toDateKey, type Task } from "@/lib/rhythm";

const hours = [8, 10, 12, 14, 16, 18, 20, 22];
const tones = { high: "peach", medium: "green", low: "violet" } as const;

function startOfWeek(date: Date) {
  const start = new Date(date);
  const distance = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - distance);
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

export function CalendarView() {
  const root = useRef<HTMLDivElement>(null);
  const calendarPanel = useRef<HTMLElement>(null);
  const { getWorkItems, completeOccurrence, uncompleteOccurrence, skipOccurrence, rescheduleOccurrence } = useRhythm();
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(() => new Date(1704110400000));
  const [occurrenceTask, setOccurrenceTask] = useState<Task | null>(null);
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const weekStart = useMemo(() => addDays(startOfWeek(now), weekOffset * 7), [now, weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const workItems = useMemo(() => getWorkItems(dateRangeFrom(weekStart, 0, 6)), [getWorkItems, weekStart]);

  const weekTasks = useMemo(() => {
    const dayKeys = new Set(days.map(toDateKey));
    return workItems.filter((task) => {
      const key = resolveTaskDate(task, now);
      return key !== null && dayKeys.has(key);
    });
  }, [days, now, workItems]);
  const scheduled = weekTasks.filter((task) => task.dueTime);
  const unscheduled = workItems.filter((task) => task.status === "pending" && (!resolveTaskDate(task, now) || !task.dueTime));
  const plannedMinutes = weekTasks.filter((task) => task.status === "pending").reduce((sum, task) => sum + task.estimateMinutes, 0);
  const upcoming = workItems
    .filter((task) => task.status === "pending")
    .map((task) => ({ task, date: taskDate(task, now) }))
    .filter((item): item is { task: Task; date: Date } => item.date !== null && item.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  useEffect(() => {
    const panel = calendarPanel.current;
    if (!panel || !window.matchMedia("(max-width: 767px)").matches) return;
    const target = panel?.querySelector<HTMLElement>(".calendar-day-head.is-active")
      ?? panel?.querySelector<HTMLElement>(".calendar-day-head");
    if (!panel || !target) return;
    panel.scrollTo({
      left: Math.max(0, target.offsetLeft - panel.clientWidth / 2 + target.clientWidth / 2),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
  }, [weekOffset, now]);

  return (
    <div className="workspace-view calendar-workspace" ref={root}>
      <header className="workspace-header" data-workspace-reveal>
        <div><p className="eyebrow">Your time, at a glance</p><h1>Calendar</h1><p className="page-subtitle">Tasks and Rhythms for these dates, with Calendar context when connected.</p></div>
        <span className="weather"><CalendarDays size={15} /> Local task view</span>
      </header>
      <section className="calendar-summary" data-workspace-reveal>
        <article className="availability-card"><div><span className="section-kicker"><Sparkles size={14} /> Dated task minutes</span><h2>{plannedMinutes ? `${Math.floor(plannedMinutes / 60)}h ${plannedMinutes % 60}m planned.` : "No dated tasks yet."}</h2><p>Based on your dated tasks only: {weekTasks.length} task{weekTasks.length === 1 ? "" : "s"}. Rhythm does not estimate your availability without evidence.</p></div></article>
        <article className="next-event-card"><span className="section-kicker"><Clock3 size={14} /> Up next</span><strong>{upcoming?.task.title ?? "Nothing scheduled"}</strong><p>{upcoming ? new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(upcoming.date) : "Add a date and time from Tasks."}</p><div><i /> {upcoming ? `${upcoming.task.estimateMinutes} min · ${upcoming.task.project}` : "Your calendar is clear"}</div></article>
      </section>
      <section className="calendar-panel" data-workspace-reveal ref={calendarPanel}>
        <div className="calendar-toolbar"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)}><ArrowLeft size={16} /></button><h2>{weekLabel(weekStart)}</h2><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)}><ArrowRight size={16} /></button><button className="today-chip" onClick={() => setWeekOffset(0)}>Today</button></div>
        <div className="calendar-grid" key={weekOffset}>
          <div className="time-gutter calendar-head"><CalendarDays size={15} /></div>
          {days.map((day) => <div className={`calendar-day-head ${toDateKey(day) === toDateKey(now) ? "is-active" : ""}`} key={toDateKey(day)}><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(day)}</span><strong>{day.getDate()}</strong></div>)}
          {hours.map((hour, row) => <div className="calendar-row" key={hour} style={{ gridRow: row + 2 }}><span>{new Intl.DateTimeFormat("en-US", { hour: "numeric" }).format(new Date(2026, 0, 1, hour))}</span></div>)}
          {scheduled.map((task) => {
            const key = resolveTaskDate(task, now);
            const day = days.findIndex((date) => toDateKey(date) === key);
            const hour = Number(task.dueTime?.slice(0, 2) || 12);
            let closestRow = 0;
            for (let index = 1; index < hours.length; index += 1) if (Math.abs(hours[index] - hour) < Math.abs(hours[closestRow] - hour)) closestRow = index;
            return <article key={task.id} className={`calendar-event tone-${tones[task.priority]} ${task.status === "completed" ? "is-done" : ""}`} style={{ gridColumn: day + 2, gridRow: closestRow + 2 }} onClick={() => task.generated ? setOccurrenceTask(task) : undefined} onKeyDown={(event) => { if (task.generated && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); setOccurrenceTask(task); } }} role={task.generated ? "button" : undefined} tabIndex={task.generated ? 0 : undefined}><small>{task.generated ? "From Rhythm · " : ""}{task.dueTime ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(dateFromKey(key!, task.dueTime)) : "Flexible"}</small><strong>{task.title}</strong></article>;
          })}
        </div>
      </section>
      <section className="calendar-agenda-mobile" aria-label="Week agenda">
        <div className="section-heading compact"><div><span className="section-kicker"><CalendarDays size={14} /> Agenda</span><h2>This week</h2></div><span>{weekTasks.length} local task{weekTasks.length === 1 ? "" : "s"}</span></div>
        <div className="calendar-agenda-days">{days.map((day) => { const key = toDateKey(day); const dayTasks = weekTasks.filter((task) => resolveTaskDate(task, now) === key).sort((a, b) => (a.dueTime ?? "99:99").localeCompare(b.dueTime ?? "99:99")); return <section key={key} className="calendar-agenda-day" aria-labelledby={`agenda-${key}`}><h3 id={`agenda-${key}`}><span>{new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(day)}</span><time dateTime={key}>{new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(day)}</time></h3>{dayTasks.length ? dayTasks.map((task) => <Link href="/tasks" key={task.id}><time>{task.dueTime ?? "Flexible"}</time><span><strong>{task.title}</strong><small>{task.generated ? "Rhythm occurrence · " : ""}{task.estimateMinutes} min{task.status === "completed" ? " · Complete" : ""}</small></span></Link>) : <p>No local tasks.</p>}</section>; })}</div>
      </section>
      <GoogleCalendarPanel start={dateFromKey(toDateKey(days[0]), "00:00").toISOString()} end={dateFromKey(toDateKey(addDays(days[6], 1)), "00:00").toISOString()} tasks={weekTasks} />
      <aside className="calendar-task-strip" data-workspace-reveal><span>{unscheduled.length} need a time</span>{unscheduled.slice(0, 4).map((task) => <Link href="/tasks" key={task.id}><article><i /><div><strong>{task.title}</strong><small>{task.generated ? "From Rhythm · " : ""}{task.estimateMinutes} min · {task.project}</small></div></article></Link>)}</aside>
      {occurrenceTask?.rhythmId && occurrenceTask.occurrenceDate ? <OccurrenceActionSheet task={occurrenceTask} onClose={() => setOccurrenceTask(null)} onComplete={() => { completeOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onUncomplete={() => { uncompleteOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onSkip={() => { skipOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onReschedule={(date, time) => { rescheduleOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }, date, time); setOccurrenceTask(null); }} /> : null}
    </div>
  );
}
