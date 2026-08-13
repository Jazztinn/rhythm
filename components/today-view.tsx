"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, ViewTransition } from "react";
import { ArrowUpRight, CalendarClock, Check, ChevronDown, Circle, Clock3, CloudSun, Sparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { OccurrenceActionSheet } from "@/components/occurrence-action-sheet";
import { EmptyState, Spinner } from "@/components/ui";
import { LEARNING_STORAGE_KEY, confirmedPatterns, migrateLearningState, type LearnedPattern } from "@/lib/learning";
import { dateRangeFrom, resolveTaskDate, selectRecommendedTask, selectTaskInventory, summarizeWorkload, toDateKey, type Task } from "@/lib/rhythm";

function TaskCard({ task, onToggle, onOpen, recommended = false, exiting = false }: { task: Task; onToggle: () => void; onOpen?: () => void; recommended?: boolean; exiting?: boolean }) {
  return <ViewTransition name={`task-${task.id}`} default="none" share="task"><li className={`task-card ${task.status === "completed" ? "is-done" : ""} ${recommended ? "is-recommended" : ""} ${exiting ? "is-exiting" : ""}`}>
    <button className="task-check" onClick={onToggle} aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}>
      {task.status === "completed" ? <Check size={15} aria-hidden="true" /> : <Circle size={15} aria-hidden="true" />}
    </button>
    <div className="task-copy">
      <div className="task-labels">
        {recommended ? <span className="task-recommendation">Recommended next</span> : null}
        <span className="task-project">{task.project}</span>
      </div>
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
  const [routineInsight, setRoutineInsight] = useState<{ pattern: LearnedPattern; confirmed: boolean } | null>(null);
  const [now, setNow] = useState(() => new Date(1704110400000));

  useEffect(() => {
    const timer = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => { window.clearTimeout(timer); window.clearInterval(interval); };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(LEARNING_STORAGE_KEY);
        const state = migrateLearningState(raw ? JSON.parse(raw) : null).state;
        const confirmed = confirmedPatterns(state)[0];
        const observation = state.enabled
          ? state.patterns.find((pattern) => pattern.status === "still-learning" || pattern.status === "keep-observing")
          : undefined;
        setRoutineInsight(confirmed ? { pattern: confirmed, confirmed: true } : observation ? { pattern: observation, confirmed: false } : null);
      } catch {
        setRoutineInsight(null);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const todayKey = toDateKey(now);
  const workItems = getWorkItems(dateRangeFrom(now, 30, 14));
  const inventory = selectTaskInventory(workItems, now, 14);
  const todayTasks = workItems.filter((task) => {
    const date = resolveTaskDate(task, now);
    return !task.later && (!date || date <= todayKey);
  });
  const pending = todayTasks.filter((task) => task.status === "pending");
  const completed = todayTasks.filter((task) => task.status === "completed");
  const later = inventory.visible.filter((task) => {
    const date = resolveTaskDate(task, now) ?? todayKey;
    return !task.generated && (task.later || date > todayKey);
  });
  const recommended = selectRecommendedTask(todayTasks, now);
  const summary = summarizeWorkload(todayTasks);
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
      <div><p className="eyebrow"><time dateTime={todayKey}>{formattedDate}</time></p><h1>{greeting}</h1><p className="page-subtitle">What should you care about right now?</p></div>
      <div className="header-actions"><span className="weather"><CloudSun size={17} aria-hidden="true" /> {new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(now)} local</span></div>
    </header>

    <section className="hero-grid" aria-label="Today summary">
      <article className={`day-card today-hero ${pending.length > 4 ? "is-busy" : "is-clear"}`}>
        <div className="hero-orb" aria-hidden="true" />
        <div className="day-card-top"><span>Today</span><i>{completed.length ? `${completed.length} complete` : "A quiet start"}</i></div>
        <div className="day-score"><strong>{pending.length ? `${pending.length} thing${pending.length === 1 ? "" : "s"} left` : "You’re clear"}</strong><div><span>{pending.length ? `About ${Math.max(5, Math.round(summary.plannedMinutes / 5) * 5)} minutes of planned work, based on your tasks.` : "Nothing needs your attention right now."}</span></div></div>
        <Link className="ai-nudge" href={recommended ? `/tasks?task=${encodeURIComponent(recommended.id)}` : "/tasks"}>
          <span className="nudge-icon"><Sparkles size={17} aria-hidden="true" /></span>
          <span><small>{recommended ? "Start with" : "Next step"}</small><strong>{recommended?.title ?? "Add a task when something needs doing."}</strong></span>
          <ArrowUpRight size={18} aria-hidden="true" />
        </Link>
      </article>

      <article className="window-card">
        <div className="section-kicker"><CalendarClock size={16} aria-hidden="true" /> Next scheduled task</div>
        <h2>{nextScheduled ? nextScheduled.task.title : "No upcoming timed task"}</h2>
        <p>{nextScheduled ? "Based on your current task list. Connect Calendar for a fuller view of your time." : "Based on your current task list. Calendar availability is not assumed."}</p>
        <div className="window-time"><strong>{freeMinutes ?? pending.reduce((sum, task) => sum + task.estimateMinutes, 0)}</strong><span>minutes<br />{freeMinutes !== null ? "until next" : "open task time"}</span></div>
        <div className="timeline"><div><i /> <span>Now</span><strong>{nextScheduled ? "Open" : "No time set"}</strong></div><div><i /> <span>{nextScheduled ? new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(nextScheduled.at) : "Later"}</span><strong>{nextScheduled?.task.title ?? "Unscheduled"}</strong></div></div>
      </article>
    </section>

    {routineInsight ? <aside className={`routine-context ${routineInsight.confirmed ? "is-confirmed" : "is-learning"}`} aria-label={routineInsight.confirmed ? "Confirmed routine context" : "Routine observation awaiting confirmation"}>
      <span className="section-kicker">{routineInsight.confirmed ? "A good time to start" : "I’ve noticed something"}</span>
      <div><strong>{routineInsight.pattern.subject}</strong><span>{routineInsight.pattern.value}</span><p>{routineInsight.confirmed ? "You confirmed this pattern. Rhythm may use it gently when suggesting what comes next." : `${routineInsight.pattern.evidence.summary} This will not shape your plan unless you confirm it.`}</p></div>
      <Link href={routineInsight.confirmed ? `/chat?prompt=${encodeURIComponent(`Is now a useful time for ${routineInsight.pattern.subject}?`)}` : "/settings"} transitionTypes={routineInsight.confirmed ? ["chat-enter"] : undefined}>{routineInsight.confirmed ? "Ask Rhythm" : "Review pattern"}<ArrowUpRight size={14} aria-hidden="true" /></Link>
    </aside> : null}

    <section className="content-grid">
      <div className="task-section">
        <div className="section-heading"><div><span className="section-kicker">Open work</span><h2>{recommended ? "Start here" : "Today"}</h2></div><span>{pending.length} remaining</span></div>
        {pending.length || exitingIds.size ? <ol className="task-list" aria-label="Open tasks for today">{todayTasks.filter((task) => task.status === "pending" || exitingIds.has(task.id)).map((task) => <TaskCard key={task.id} task={task} exiting={exitingIds.has(task.id)} recommended={task.id === recommended?.id} onToggle={() => toggleWorkItem(task)} onOpen={task.generated ? () => setOccurrenceTask(task) : undefined} />)}</ol> : <EmptyState title="Nothing needs your attention right now" description="You’re clear for now." action={<Link className="soft-button" href="/tasks">Open Tasks</Link>} />}
        <button className={`later-toggle ${laterOpen ? "is-open" : ""}`} onClick={() => setLaterOpen((open) => !open)} aria-expanded={laterOpen}><span>Later <i>{later.length}</i></span><ChevronDown size={17} aria-hidden="true" /></button>
        {laterOpen ? <ol className="later-list" aria-label="Later tasks">{later.map((task) => <TaskCard key={task.id} task={task} onToggle={() => toggleWorkItem(task)} onOpen={task.generated ? () => setOccurrenceTask(task) : undefined} />)}</ol> : null}
      </div>

      <aside className="week-card">
        <div className="section-heading compact"><div><span className="section-kicker">Your week</span><h2>{later.length ? "A few things are waiting." : "The rest looks quiet."}</h2></div></div>
        <div className="week-note"><Sparkles size={16} aria-hidden="true" /><p><strong>Based on your current tasks.</strong> Calendar context appears only after a connection is confirmed.</p></div>
      </aside>
    </section>
    {occurrenceTask?.rhythmId && occurrenceTask.occurrenceDate ? <OccurrenceActionSheet task={occurrenceTask} onClose={() => setOccurrenceTask(null)} onComplete={() => { completeOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onUncomplete={() => { uncompleteOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onSkip={() => { skipOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onReschedule={(date, time) => { rescheduleOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }, date, time); setOccurrenceTask(null); }} /> : null}
  </div>;
}
