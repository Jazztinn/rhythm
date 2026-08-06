"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ArrowLeft, ArrowRight, CalendarDays, Clock3, Sparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { addDays, resolveTaskDate, toDateKey, type Task } from "@/lib/rhythm";

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
  const { tasks } = useRhythm();
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(() => new Date(1704110400000));
  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0);
    return () => window.clearTimeout(timer);
  }, []);
  const weekStart = useMemo(() => addDays(startOfWeek(now), weekOffset * 7), [now, weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);

  const weekTasks = useMemo(() => {
    const dayKeys = new Set(days.map(toDateKey));
    return tasks.filter((task) => {
      const key = resolveTaskDate(task, now);
      return task.status === "pending" && key !== null && dayKeys.has(key);
    });
  }, [days, now, tasks]);
  const scheduled = weekTasks.filter((task) => task.dueTime);
  const unscheduled = tasks.filter((task) => task.status === "pending" && (!resolveTaskDate(task, now) || !task.dueTime));
  const plannedMinutes = weekTasks.reduce((sum, task) => sum + task.estimateMinutes, 0);
  const roomMinutes = Math.max(0, 40 * 60 - plannedMinutes);
  const upcoming = tasks
    .filter((task) => task.status === "pending")
    .map((task) => ({ task, date: taskDate(task, now) }))
    .filter((item): item is { task: Task; date: Date } => item.date !== null && item.date.getTime() >= now.getTime())
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => gsap.from("[data-workspace-reveal]", { opacity: 0, y: 18, duration: 0.72, stagger: 0.08, ease: "power3.out" }), root);
    return () => context.revert();
  }, []);

  useLayoutEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const panel = calendarPanel.current;
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
        <div><p className="eyebrow">Your time, at a glance</p><h1>Calendar</h1><p className="page-subtitle">Every dated task appears here automatically.</p></div>
        <span className="weather"><CalendarDays size={15} /> Live tasks</span>
      </header>
      <section className="calendar-summary" data-workspace-reveal>
        <article className="availability-card"><div><span className="section-kicker"><Sparkles size={14} /> Breathing room</span><h2>{plannedMinutes < 12 * 60 ? "You have space to think." : "This week needs editing."}</h2><p>{Math.floor(plannedMinutes / 60)}h {plannedMinutes % 60}m planned from {weekTasks.length} dated task{weekTasks.length === 1 ? "" : "s"}. Capacity uses a 40-hour week.</p></div><strong>{String(Math.floor(roomMinutes / 60)).padStart(2, "0")}<small>h</small><br />{String(roomMinutes % 60).padStart(2, "0")}<small>m</small></strong></article>
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
            return <article key={task.id} className={`calendar-event tone-${tones[task.priority]}`} style={{ gridColumn: day + 2, gridRow: closestRow + 2 }}><small>{task.dueTime ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(dateFromKey(key!, task.dueTime)) : "Flexible"}</small><strong>{task.title}</strong></article>;
          })}
        </div>
      </section>
      <aside className="calendar-task-strip" data-workspace-reveal><span>{unscheduled.length} need a time</span>{unscheduled.slice(0, 4).map((task) => <Link href="/tasks" key={task.id}><article><i /><div><strong>{task.title}</strong><small>{task.estimateMinutes} min · {task.project}</small></div></article></Link>)}</aside>
    </div>
  );
}
