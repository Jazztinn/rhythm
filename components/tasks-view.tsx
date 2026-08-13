"use client";

import { useEffect, useMemo, useState, ViewTransition } from "react";
import Link from "next/link";
import { ArrowRight, Check, Clock3, Pencil, Plus, RotateCcw, Search, Sparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { OccurrenceActionSheet } from "@/components/occurrence-action-sheet";
import { EmptyState, Button, Spinner } from "@/components/ui";
import { dateRangeFrom, resolveTaskDate, selectTaskInventory, toDateKey, type Task, type TaskDraft } from "@/lib/rhythm";
import { TaskEditor } from "@/components/task-editor";

type Filter = "all" | "today" | "overdue" | "upcoming" | "later";

function taskBucket(task: Task, today: string): Exclude<Filter, "all"> {
  if (task.later) return "later";
  const date = resolveTaskDate(task, new Date(`${today}T12:00:00`));
  if (!date || date === today) return "today";
  return date < today ? "overdue" : "upcoming";
}

function TaskRow({ task, onToggle, onEdit, exiting = false, completing = false }: { task: Task; onToggle: () => void; onEdit: () => void; exiting?: boolean; completing?: boolean }) {
  return <ViewTransition name={`task-${task.id}`} default="none" share="task"><li className={`ron-task-row ${task.status === "completed" ? "is-done" : ""} ${completing ? "is-completing" : ""} ${exiting ? "is-exiting" : ""}`}>
    <button className="ron-task-check" disabled={completing} onClick={onToggle} aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}><Check size={16} aria-hidden="true" /></button>
    <span className={`priority-dot priority-${task.priority}`} aria-label={`${task.priority} priority`} />
    <div className="ron-task-copy"><span>{task.project}</span><h3>{task.title}</h3>{task.note ? <p>{task.note}</p> : null}</div>
    <time dateTime={task.dueDate}>{task.dueLabel}</time><small><Clock3 size={13} aria-hidden="true" /> {task.estimateMinutes} min</small>
    <button className="task-edit-button" onClick={onEdit} aria-label={`Edit ${task.title}`}><Pencil size={15} aria-hidden="true" /></button>
  </li></ViewTransition>;
}

export function TasksView() {
  const { getWorkItems, hydrated, toggleTask, completeOccurrence, uncompleteOccurrence, skipOccurrence, rescheduleOccurrence, createTask, updateTask, deleteTask, canUndo, undoLast } = useRhythm();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [editorTask, setEditorTask] = useState<Task | "new" | null>(null);
  const [occurrenceTask, setOccurrenceTask] = useState<Task | null>(null);
  const [completedLimit, setCompletedLimit] = useState(40);
  const [exitingIds, setExitingIds] = useState<Set<string>>(new Set());
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const today = toDateKey(new Date());
  const workItems = useMemo(() => getWorkItems(dateRangeFrom(new Date(), 90, 14)), [getWorkItems]);
  const projects = useMemo(() => [...new Set(workItems.map((task) => task.project).filter(Boolean))].sort(), [workItems]);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      const requestedId = new URLSearchParams(window.location.search).get("task");
      const requestedTask = requestedId ? workItems.find((task) => task.id === requestedId) : undefined;
      if (requestedTask) (requestedTask.generated ? setOccurrenceTask : setEditorTask)(requestedTask);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [hydrated, workItems]);

  const inventory = useMemo(() => selectTaskInventory(workItems, new Date(), 14), [workItems]);
  const openTasks = useMemo(() => inventory.visible.filter((task) => task.status === "pending"), [inventory.visible]);
  const completedTasks = useMemo(() => inventory.visible.filter((task) => task.status === "completed"), [inventory.visible]);
  const inventoryTasks = useMemo(() => {
    const active = new Set(exitingIds);
    const pending = inventory.visible.filter((task) => task.status === "pending" || active.has(task.id));
    const nextByRhythm = new Map<string, Task>();
    for (const task of pending) {
      if (!task.generated || !task.rhythmId) continue;
      const bucket = taskBucket(task, today);
      if (bucket === "today" || bucket === "overdue") continue;
      if (!nextByRhythm.has(task.rhythmId)) nextByRhythm.set(task.rhythmId, task);
    }
    return pending.filter((task) => !task.generated || !task.rhythmId || taskBucket(task, today) === "today" || taskBucket(task, today) === "overdue" || nextByRhythm.get(task.rhythmId)?.id === task.id);
  }, [exitingIds, inventory.visible, today]);
  const visibleTasks = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase();
    return inventoryTasks.filter((task) => {
      const matchesFilter = filter === "all" || taskBucket(task, today) === filter;
      const matchesQuery = !clean || `${task.title} ${task.project} ${task.note ?? ""}`.toLocaleLowerCase().includes(clean);
      const matchesProject = project === "all" || task.project === project;
      return matchesFilter && matchesQuery && matchesProject;
    });
  }, [filter, inventoryTasks, project, query, today]);

  function saveTask(draft: TaskDraft) {
    if (editorTask === "new") createTask(draft);
    else if (editorTask) updateTask(editorTask.id, draft);
    setEditorTask(null);
  }

  function toggleWorkItem(task: Task) {
    const commit = () => {
      setCompletingIds((current) => { const next = new Set(current); next.delete(task.id); return next; });
      setExitingIds((current) => new Set(current).add(task.id));
      if (task.generated && task.rhythmId && task.occurrenceDate) {
        const occurrence = { rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate };
        (task.status === "completed" ? uncompleteOccurrence : completeOccurrence)(occurrence);
      } else toggleTask(task.id);
      window.setTimeout(() => setExitingIds((current) => { const next = new Set(current); next.delete(task.id); return next; }), 260);
    };
    if (task.status === "completed") return commit();
    setCompletingIds((current) => new Set(current).add(task.id));
    window.setTimeout(commit, 220);
  }

  if (!hydrated) return <div className="workspace-view"><div className="loading-panel"><Spinner label="Loading tasks" /><p>Preparing Tasks from your local workspace…</p></div></div>;

  const filterLabels: Array<[Filter, string]> = [["all", "All open"], ["today", "Today"], ["overdue", "Overdue"], ["upcoming", "Upcoming"], ["later", "Later"]];
  const filteredByControls = Boolean(query.trim() || project !== "all" || filter !== "all");
  const visibleCompletedTasks = completedTasks.slice(0, completedLimit);
  const totalMinutes = openTasks.reduce((sum, task) => sum + task.estimateMinutes, 0);
  const rhythmScore = Math.max(35, Math.min(96, Math.round(92 - Math.max(0, openTasks.length - 4) * 3 - Math.min(24, totalMinutes / 90))));
  const nextTask = [...openTasks].sort((a, b) => `${resolveTaskDate(a) ?? "9999"}${a.dueTime ?? ""}`.localeCompare(`${resolveTaskDate(b) ?? "9999"}${b.dueTime ?? ""}`))[0];

  return <div className="workspace-view tasks-view ron-tasks-view">
    <header className="workspace-header ron-tasks-header">
      <div><p className="eyebrow">What needs doing</p><div className="ron-title-line"><h1>Tasks</h1><span className="ron-count-pill"><i /> <b>{openTasks.length}</b> in view</span></div></div>
      <div className="workspace-header-actions">{canUndo ? <Button type="button" onClick={undoLast}><RotateCcw size={15} aria-hidden="true" /> Undo last change</Button> : null}<Button variant="primary" onClick={() => setEditorTask("new")}><Plus size={17} aria-hidden="true" /> Add task</Button></div>
    </header>

    <section className="ron-task-metrics" aria-label="Task overview">
      <article className="ron-metric ron-metric--score"><div><span>Rhythm score</span><i>{rhythmScore >= 70 ? "Optimal" : "Needs space"}</i></div><div className="ron-score"><strong>{rhythmScore}</strong><small>/ 100</small></div><p>{openTasks.length} open tasks · {totalMinutes} minutes nearby</p><div className="ron-score-track"><i style={{ width: `${rhythmScore}%` }} /></div></article>
      <article className="ron-metric ron-metric--next"><div><span>Up next</span><time>{nextTask?.dueTime || nextTask?.dueLabel || "All clear"}</time></div>{nextTask ? <><p>{nextTask.project}</p><h2>{nextTask.title}</h2><small>{nextTask.note || "Ready when you are."}</small><footer><i className={`priority-dot priority-${nextTask.priority}`} /> {nextTask.estimateMinutes} min duration</footer></> : <><h2>Nothing queued</h2><small>Add a task when something needs a place.</small></>}</article>
      <article className="ron-metric ron-metric--ask"><div><span><Sparkles size={13} aria-hidden="true" /> Need a read</span><Link href={`/chat?prompt=${encodeURIComponent("Which open task should I handle first, and why?")}`} transitionTypes={["chat-enter"]}>Ask Rhythm <ArrowRight size={13} aria-hidden="true" /></Link></div><p>Ask about your task list; no changes occur without your approval.</p><div className="ron-wave" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} style={{ animationDelay: `${index * -70}ms` }} />)}</div></article>
    </section>

    <section className="workspace-panel tasks-panel ron-tasks-panel">
      <div className="task-toolbar">
        <div className="filter-tabs" aria-label="Task views">{filterLabels.map(([value, label]) => <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <label className="task-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search tasks, projects, and notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, projects, notes" /></label>
        {projects.length > 1 ? <label className="project-filter"><span className="sr-only">Filter by project</span><select value={project} onChange={(event) => setProject(event.target.value)}><option value="all">All projects</option>{projects.map((name) => <option key={name} value={name}>{name}</option>)}</select></label> : null}
      </div>
      <div className="task-groups">
        {filterLabels.slice(1).map(([bucket, label]) => {
          const group = visibleTasks.filter((task) => taskBucket(task, today) === bucket);
          if (filter !== "all" && filter !== bucket) return null;
          return <section className="task-group" key={bucket} aria-labelledby={`task-group-${bucket}`}><div className="task-group__heading"><h2 id={`task-group-${bucket}`}>{label}</h2><span>{group.length}</span></div>{group.length ? <ol className="full-task-list" aria-label={`${label} tasks`}>{group.map((task) => <TaskRow key={task.id} task={task} exiting={exitingIds.has(task.id) || deletingId === task.id} completing={completingIds.has(task.id)} onToggle={() => toggleWorkItem(task)} onEdit={() => task.generated ? setOccurrenceTask(task) : setEditorTask(task)} />)}</ol> : <p className="task-group__empty">No {label.toLocaleLowerCase()} open tasks.</p>}</section>;
        })}
        {!visibleTasks.length && filteredByControls ? <EmptyState title="No tasks match these filters" description="Try another view, project, or search term." action={<Button type="button" onClick={() => { setFilter("all"); setProject("all"); setQuery(""); }}>Clear filters</Button>} /> : null}
        {!openTasks.length && !filteredByControls ? <EmptyState title="Nothing needs your attention right now" description="Add a task when something needs a place." action={<Button type="button" variant="primary" onClick={() => setEditorTask("new")}>Add a task</Button>} /> : null}
      </div>
    </section>

    <details className="completed-tasks"><summary>Completed <span>{completedTasks.length}</span></summary>{completedTasks.length ? <ol className="full-task-list">{visibleCompletedTasks.map((task) => <TaskRow key={task.id} task={task} exiting={deletingId === task.id} onToggle={() => toggleWorkItem(task)} onEdit={() => task.generated ? setOccurrenceTask(task) : setEditorTask(task)} />)}</ol> : <p>No completed tasks yet.</p>}{completedTasks.length > completedLimit ? <Button type="button" onClick={() => setCompletedLimit((limit) => limit + 40)}>Show 40 more completed</Button> : null}</details>

    {editorTask ? <TaskEditor key={editorTask === "new" ? "new" : editorTask.id} task={editorTask === "new" ? undefined : editorTask} onClose={() => setEditorTask(null)} onSave={saveTask} onDelete={editorTask === "new" ? undefined : () => { const id = editorTask.id; setDeletingId(id); setEditorTask(null); window.setTimeout(() => { deleteTask(id); setDeletingId(null); }, 240); }} /> : null}
    {occurrenceTask?.rhythmId && occurrenceTask.occurrenceDate ? <OccurrenceActionSheet task={occurrenceTask} onClose={() => setOccurrenceTask(null)} onComplete={() => { completeOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onUncomplete={() => { uncompleteOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onSkip={() => { skipOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onReschedule={(date, time) => { rescheduleOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }, date, time); setOccurrenceTask(null); }} /> : null}
  </div>;
}
