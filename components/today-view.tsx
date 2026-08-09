"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, ViewTransition } from "react";
import { ArrowUpRight, CalendarClock, Check, ChevronDown, Circle, Clock3, CloudSun, Sparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { OccurrenceActionSheet } from "@/components/occurrence-action-sheet";
import { EmptyState, Spinner } from "@/components/ui";
import { addDays, dateRangeFrom, resolveTaskDate, selectRecommendedTask, selectTaskInventory, summarizeWorkload, toDateKey, type Task } from "@/lib/rhythm";

function TaskCard({ task, onToggle, onOpen, recommended = false, exiting = false }: { task: Task; onToggle: () => void; onOpen?: () => void; recommended?: boolean; exiting?: boolean }) {
  return <ViewTransition name={`task-${task.id}`} default="none" share="task"><li className={`task-card ${task.status === "completed" ? "is-done" : ""} ${recommended ? "is-recommended" : ""} ${exiting ? "is-exiting" : ""}`}>
    <button className="task-check" onClick={onToggle} aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}>
      {task.status === "completed" ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
    </button>
    <div className="task-copy">
      {recommended ? <span className="task-recommendation">Recommended next</span> : null}
      <span className="task-project">{task.project}</span>
      <h3>{task.title}</h3>
      {task.note ? <p>{task.note}</p> : null}
    </div>
    <div className="task-meta">
      <time dateTime={task.dueDate}>{task.dueLabel}</time>
      <span><Clock3 size={13} aria-hidden="true" />≈ {task.estimateMinutes} min</span>
    </div>
    {onOpen ? <button className="task-open" type="button" onClick={onOpen} aria-label={`Open ${task.title}`}><ArrowUpRight size={15} aria-hidden="true" /></button> : null}
  </li></ViewTransition>;
}

export function TodayView() {
  const { getWorkItems, hydrated, toggleTask, completeOccurrence, uncompleteOccurrence, skipOccurrence, rescheduleOccurrence } = useRhythm();
  const [laterOpen, setLaterOpen] = useState(false);
  const [occurrenceTask, setOccurrenceTask] = useState<Task | null>(null);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => new Date(1704110400000));

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, []);

  const todayKey = toDateKey(now);
  const workItems = getWorkItems(dateRangeFrom(now, 30, 30));
  const inventory = selectTaskInventory(workItems, now, 14);
  const todayTasks = workItems.filter((task) => {
    const date = resolveTaskDate(task, now);
    return !task.later && (!date || date <= todayKey);
  });
  const pending = todayTasks.filter((task) => task.status === "pending");
  const completed = todayTasks.filter((task) => task.status === "completed");
  const later = inventory.visible.filter((task) => task.later || (resolveTaskDate(task, now) ?? todayKey) > todayKey);
  const recommended = selectRecommendedTask(todayTasks, now);
  const summary = summarizeWorkload(todayTasks);
  const progress = todayTasks.length ? Math.round((completed.length / todayTasks.length) * 100) : 0;
  const nextScheduled = workItems
    .filter((task) => task.status === "pending" && task.dueTime)
    .map((task) => {
      const date = resolveTaskDate(task, now);
      return date ? { task, at: new Date(`${date}T${task.dueTime}:00`) } : null;
    })
    .filter((item): item is { task: Task; at: Date } => item !== null && item.at.getTime() >= now.getTime())
    .sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  const freeMinutes = nextScheduled && toDateKey(nextScheduled.at) === todayKey
    ? Math.max(0, Math.round((nextScheduled.at.getTime() - now.getTime()) / 60000))
    : null;
  const formattedDate = useMemo(() => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now), [now]);
  const greeting = now.getHours() < 12 ? "Good morning." : now.getHours() < 18 ? "Good afternoon." : "Good evening.";
  const weekStart = addDays(now, -((now.getDay() + 6) % 7));
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const key = toDateKey(date);
    const minutes = workItems.filter((task) => task.status === "pending" && resolveTaskDate(task, now) === key).reduce((sum, task) => sum + task.estimateMinutes, 0);
    return { day: new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date), load: Math.min(100, Math.max(8, Math.round((minutes / 240) * 100))), minutes, active: key === todayKey };
  });

  if (!hydrated) return <div className="today-view"><div className="loading-panel"><Spinner label="Loading Today" /><p>Preparing Today from your local workspace…</p></div></div>;

  const toggleWorkItem = (task: Task) => {
    setExitingIds((current) => new Set(current).add(task.id));
    window.setTimeout(() => setExitingIds((current) => { const next = new Set(current); next.delete(task.id); return next; }), 260);
    if (task.generated && task.rhythmId && task.occurrenceDate) {
      const occurrence = { rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate };
      (task.status === "completed" ? uncompleteOccurrence : completeOccurrence)(occurrence);
    } else toggleTask(task.id);
  };

  return <div className="today-view">
    <header className="page-header">
      <div><p className="eyebrow"><time dateTime={todayKey}>{formattedDate}</time></p><h1>{greeting}</h1><p className="page-subtitle">A factual view of what is still open.</p></div>
      <div className="header-actions"><span className="weather"><CloudSun size={17} aria-hidden="true" /> {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now)} local</span></div>
    </header>

    <section className="hero-grid" aria-label="Today summary">
      <article className={`day-card today-hero ${pending.length > 4 ? "is-busy" : "is-clear"}`}>
        <div className="hero-orb" aria-hidden="true" />
        <div className="day-card-top"><span>Today</span><i>{completed.length} of {todayTasks.length} complete</i></div>
        <div className="day-score"><strong>{pending.length} open</strong><div><span>{summary.statement}</span></div></div>
        <div className="progress-track" role="progressbar" aria-label="Today task completion" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }} /></div>
        <div className="day-card-bottom"><span>{summary.datedCount} dated</span><span>{summary.plannedMinutes} min planned</span></div>
        <Link className="ai-nudge" href={recommended ? `/tasks?task=${encodeURIComponent(recommended.id)}` : "/tasks"}>
          <span className="nudge-icon"><Sparkles size={17} aria-hidden="true" /></span>
          <span><small>{recommended ? "Start with" : "Next step"}</small><strong>{recommended?.title ?? "Add a task when something needs doing."}</strong></span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </article>

      <article className="window-card">
        <div className="section-kicker"><CalendarClock size={16} aria-hidden="true" /> Next scheduled task</div>
        <h2>{nextScheduled ? nextScheduled.task.title : "No upcoming timed task"}</h2>
        <p>{nextScheduled ? "The next timed task in your local task list." : "Remaining work has no fixed time in the local task list."}</p>
        <div className="window-time"><strong>{freeMinutes ?? pending.reduce((sum, task) => sum + task.estimateMinutes, 0)}</strong><span>minutes<br />{freeMinutes !== null ? "until next" : "open task time"}</span></div>
        <div className="timeline"><div><i /> <span>Now</span><strong>{nextScheduled ? "Open" : "No time set"}</strong></div><div><i /> <span>{nextScheduled ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(nextScheduled.at) : "Later"}</span><strong>{nextScheduled?.task.title ?? "Unscheduled"}</strong></div></div>
      </article>
    </section>

    <div className="embedded-assist"><span className="section-kicker"><Sparkles size={14} aria-hidden="true" /> Quiet assistance</span><span>Use the current open work as context. Nothing changes until you approve it.</span><Link href={`/chat?prompt=${encodeURIComponent("What is the smallest useful next step from today's open work?")}`}>Ask Rhythm <ArrowUpRight size={14} aria-hidden="true" /></Link></div>

    <section className="content-grid">
      <div className="task-section">
        <div className="section-heading"><div><span className="section-kicker">Open work</span><h2>{recommended ? "Start here" : "Today"}</h2></div><span>{pending.length} remaining</span></div>
        {pending.length || exitingIds.size ? <ol className="task-list" aria-label="Open tasks for today">{todayTasks.filter((task) => task.status === "pending" || exitingIds.has(task.id)).map((task) => <TaskCard key={task.id} task={task} exiting={exitingIds.has(task.id)} recommended={task.id === recommended?.id} onToggle={() => toggleWorkItem(task)} onOpen={task.generated ? () => setOccurrenceTask(task) : undefined} />)}</ol> : <EmptyState title="No open tasks for today" description="Your local task list has no pending work in this view." action={<Link className="soft-button" href="/tasks">Open Tasks</Link>} />}
        <button className={`later-toggle ${laterOpen ? "is-open" : ""}`} onClick={() => setLaterOpen((open) => !open)} aria-expanded={laterOpen}><span>Later <i>{later.length}</i>{inventory.hiddenGeneratedOpen ? <small> · more in Tasks</small> : null}</span><ChevronDown size={17} aria-hidden="true" /></button>
        {laterOpen ? <ol className="later-list" aria-label="Later tasks">{later.map((task) => <TaskCard key={task.id} task={task} onToggle={() => toggleWorkItem(task)} onOpen={task.generated ? () => setOccurrenceTask(task) : undefined} />)}</ol> : null}
      </div>

      <aside className="week-card">
        <div className="section-heading compact"><div><span className="section-kicker">This week</span><h2>Task minutes</h2></div></div>
        <div className="week-bars" aria-label="Pending task minutes by day">{week.map((item) => <div className={item.active ? "is-active" : ""} key={item.day}><span><i style={{ height: `${item.load}%` }} /></span><small>{item.day}</small></div>)}</div>
        <div className="week-note"><Sparkles size={16} aria-hidden="true" /><p><strong>{summary.evidence === "tasks-only" ? "Based on your tasks only." : "Based on tasks and calendar evidence."}</strong> Daily bars show estimated minutes from pending tasks.</p></div>
      </aside>
    </section>
    {occurrenceTask?.rhythmId && occurrenceTask.occurrenceDate ? <OccurrenceActionSheet task={occurrenceTask} onClose={() => setOccurrenceTask(null)} onComplete={() => { completeOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onUncomplete={() => { uncompleteOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onSkip={() => { skipOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onReschedule={(date, time) => { rescheduleOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }, date, time); setOccurrenceTask(null); }} /> : null}
  </div>;
}
