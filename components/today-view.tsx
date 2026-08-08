"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  CloudSun,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { DotNumber } from "@/components/dot-number";
import { useRhythm } from "@/components/rhythm-provider";
import type { Task } from "@/lib/rhythm";

const week = [
  { day: "Mon", load: 42 },
  { day: "Tue", load: 58 },
  { day: "Wed", load: 72 },
  { day: "Thu", load: 36 },
  { day: "Fri", load: 64 },
  { day: "Sat", load: 44, active: true },
  { day: "Sun", load: 20 },
];

function TaskCard({ task, onToggle }: { task: Task; onToggle: () => void }) {
  return (
    <article className={`task-card ${task.status === "completed" ? "is-done" : ""}`}>
      <button
        className="task-check"
        onClick={onToggle}
        aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}
      >
        {task.status === "completed" ? <Check size={15} /> : <Circle size={15} />}
      </button>
      <div className="task-copy">
        <span className="task-project">{task.project}</span>
        <h3>{task.title}</h3>
        {task.note ? <p>{task.note}</p> : null}
      </div>
      <div className="task-meta">
        <strong>{task.dueLabel}</strong>
        <span><Clock3 size={13} />≈ {task.estimateMinutes} min</span>
      </div>
    </article>
  );
}

export function TodayView() {
  const root = useRef<HTMLDivElement>(null);
  const [laterOpen, setLaterOpen] = useState(false);
  const { tasks, toggleTask, reset } = useRhythm();

  const todayTasks = tasks.filter((task) => !task.later);
  const pending = todayTasks.filter((task) => task.status === "pending");
  const completed = todayTasks.filter((task) => task.status === "completed");
  const later = tasks.filter((task) => task.later);
  const progress = todayTasks.length ? Math.round((completed.length / todayTasks.length) * 100) : 100;
  const formattedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      }).format(new Date()),
    [],
  );
  const greeting = new Date().getHours() < 12 ? "Good morning." : new Date().getHours() < 18 ? "Good afternoon." : "Good evening.";
  const visualState = pending.length <= 2 ? "is-clear" : pending.length <= 4 ? "is-steady" : "is-busy";

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from("[data-reveal]", {
        opacity: 0,
        y: 20,
        duration: 0.75,
        stagger: 0.08,
        ease: "power3.out",
      });
      gsap.to(".hero-orb", {
        xPercent: 8,
        yPercent: -6,
        duration: 8,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, root);
    return () => context.revert();
  }, []);

  return (
    <div className="today-view" ref={root}>
      <header className="page-header" data-reveal>
        <div>
          <p className="eyebrow">{formattedDate}</p>
          <h1>{greeting}</h1>
          <p className="page-subtitle">You&apos;ve done enough to stay on track today.</p>
        </div>
        <div className="header-actions">
          <span className="weather"><CloudSun size={17} /> 28° Manila</span>
          <button className="soft-button" onClick={reset} title="Restore demo tasks">
            <RotateCcw size={15} /> Reset day
          </button>
        </div>
      </header>

      <section className="hero-grid" data-reveal>
        <article className={`day-card ${visualState}`}>
          <div className="hero-orb" aria-hidden="true" />
          <div className="day-card-top">
            <span>Today</span>
            <i>{progress}% complete</i>
          </div>
          <div className="day-score">
            <DotNumber value={String(pending.length).padStart(2, "0")} />
            <div>
              <strong>{pending.length === 1 ? "thing" : "things"} left</strong>
              <span>{pending.length <= 2 ? "A light finish." : "A comfortable pace."}</span>
            </div>
          </div>
          <div className="progress-track" aria-label={`${progress}% complete`}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <div className="day-card-bottom">
            <span>{completed.length} finished</span>
            <span>{pending.reduce((total, task) => total + task.estimateMinutes, 0)} min planned</span>
          </div>

          <Link
            className="ai-nudge"
            href="/chat?prompt=Plan%20the%20rest%20of%20my%20evening%20around%20what%20is%20still%20unfinished."
          >
            <span className="nudge-icon"><Sparkles size={17} /></span>
            <span>
              <small>Good time to work</small>
              <strong>You have 52 minutes free.</strong>
            </span>
            <ArrowUpRight size={18} />
          </Link>
        </article>

        <article className="window-card">
          <div className="section-kicker"><CalendarClock size={16} /> Next window</div>
          <h2>Before NEXT sync</h2>
          <p>One clear block, then your evening opens up.</p>
          <div className="window-time">
            <strong>52</strong>
            <span>minutes<br />available</span>
          </div>
          <div className="timeline">
            <div><i /> <span>Now</span><strong>Open</strong></div>
            <div><i /> <span>7:30 PM</span><strong>NEXT sync</strong></div>
            <div><i /> <span>8:15 PM</span><strong>Clear</strong></div>
          </div>
        </article>
      </section>

      <section className="content-grid">
        <div className="task-section" data-reveal>
          <div className="section-heading">
            <div>
              <span className="section-kicker">Up next</span>
              <h2>Worth finishing</h2>
            </div>
            <span>{pending.length} remaining</span>
          </div>
          <div className="task-list">
            {pending.slice(0, 3).map((task) => (
              <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
            ))}
            {pending.length === 0 ? (
              <div className="all-clear">
                <Check size={18} /> Nothing urgent. You can stop for today.
              </div>
            ) : null}
          </div>

          <button
            className={`later-toggle ${laterOpen ? "is-open" : ""}`}
            onClick={() => setLaterOpen((open) => !open)}
            aria-expanded={laterOpen}
          >
            <span>Later <i>{later.length}</i></span>
            <ChevronDown size={17} />
          </button>
          {laterOpen ? (
            <div className="later-list">
              {later.map((task) => (
                <TaskCard key={task.id} task={task} onToggle={() => toggleTask(task.id)} />
              ))}
            </div>
          ) : null}
        </div>

        <aside className="week-card" data-reveal>
          <div className="section-heading compact">
            <div>
              <span className="section-kicker">Your week</span>
              <h2>Mostly balanced</h2>
            </div>
            <span className="status-pill">On track</span>
          </div>
          <div className="week-bars">
            {week.map((item) => (
              <div className={item.active ? "is-active" : ""} key={item.day}>
                <span><i style={{ height: `${item.load}%` }} /></span>
                <small>{item.day}</small>
              </div>
            ))}
          </div>
          <div className="week-note">
            <Sparkles size={16} />
            <p><strong>Monday looks crowded.</strong> Two flexible tasks can move to Tuesday.</p>
          </div>
        </aside>
      </section>
    </div>
  );
}
