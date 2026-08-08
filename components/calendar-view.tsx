"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronDown, Clock3, Sparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";

const days = [
  { name: "Mon", date: 3 }, { name: "Tue", date: 4 }, { name: "Wed", date: 5 },
  { name: "Thu", date: 6 }, { name: "Fri", date: 7 }, { name: "Sat", date: 8, active: true }, { name: "Sun", date: 9 },
];
const events = [
  { day: 1, start: 1, span: 2, time: "10:00", title: "Design critique", tone: "green" },
  { day: 2, start: 4, span: 2, time: "1:00", title: "Deep work", tone: "peach" },
  { day: 4, start: 2, span: 2, time: "11:00", title: "TechForGood", tone: "violet" },
  { day: 6, start: 3, span: 2, time: "12:00", title: "NEXT sync", tone: "green" },
];

export function CalendarView() {
  const root = useRef<HTMLDivElement>(null);
  const { tasks } = useRhythm();
  const [weekOffset, setWeekOffset] = useState(0);
  const pending = tasks.filter((task) => task.status === "pending");

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => gsap.from("[data-workspace-reveal]", { opacity: 0, y: 18, duration: 0.72, stagger: 0.08, ease: "power3.out" }), root);
    return () => context.revert();
  }, []);

  return (
    <div className="workspace-view calendar-workspace" ref={root}>
      <header className="workspace-header" data-workspace-reveal>
        <div><p className="eyebrow">Your time, at a glance</p><h1>Calendar</h1><p className="page-subtitle">Protect open space before filling it.</p></div>
        <span className="weather">Week <ChevronDown size={14} /></span>
      </header>
      <section className="calendar-summary" data-workspace-reveal>
        <article className="availability-card"><div><span className="section-kicker"><Sparkles size={14} /> Breathing room</span><h2>You have space to think.</h2><p>Three calm windows remain this week. Keep Saturday afternoon open.</p></div><strong>06<small>h</small><br />30<small>m</small></strong></article>
        <article className="next-event-card"><span className="section-kicker"><Clock3 size={14} /> Up next</span><strong>NEXT sync</strong><p>Today · 7:30–8:15 PM</p><div><i /> Starts in 52 minutes</div></article>
      </section>
      <section className="calendar-panel" data-workspace-reveal>
        <div className="calendar-toolbar"><button aria-label="Previous week" onClick={() => setWeekOffset((value) => value - 1)}><ArrowLeft size={16} /></button><h2>{weekOffset === 0 ? "August 3–9" : weekOffset < 0 ? "Previous week" : "Next week"}</h2><button aria-label="Next week" onClick={() => setWeekOffset((value) => value + 1)}><ArrowRight size={16} /></button><button className="today-chip" onClick={() => setWeekOffset(0)}>Today</button></div>
        <div className="calendar-grid">
          <div className="time-gutter calendar-head"><CalendarDays size={15} /></div>
          {days.map((day) => <div className={`calendar-day-head ${day.active && weekOffset === 0 ? "is-active" : ""}`} key={day.name}><span>{day.name}</span><strong>{day.date + weekOffset * 7}</strong></div>)}
          {["9 AM", "10 AM", "11 AM", "12 PM", "1 PM", "2 PM", "3 PM"].map((time, row) => (
            <div className="calendar-row" key={time} style={{ gridRow: row + 2 }}><span>{time}</span></div>
          ))}
          {weekOffset === 0 ? events.map((event) => <article key={event.title} className={`calendar-event tone-${event.tone}`} style={{ gridColumn: event.day + 2, gridRow: `${event.start + 2} / span ${event.span}` }}><small>{event.time}</small><strong>{event.title}</strong></article>) : null}
          {weekOffset === 0 ? <div className="now-line" style={{ gridColumn: 7, gridRow: 6 }}><i /><span /></div> : null}
        </div>
      </section>
      <aside className="calendar-task-strip" data-workspace-reveal><span>{pending.length} unscheduled tasks</span>{pending.slice(0, 3).map((task) => <article key={task.id}><i /><div><strong>{task.title}</strong><small>{task.estimateMinutes} min · {task.project}</small></div></article>)}</aside>
    </div>
  );
}
