"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Circle, Clock3, Pencil, Plus, Search } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { OccurrenceActionSheet } from "@/components/occurrence-action-sheet";
import { EmptyState, Button, Spinner } from "@/components/ui";
import { dateRangeFrom, resolveTaskDate, toDateKey, type Task, type TaskDraft } from "@/lib/rhythm";
import { TaskEditor } from "@/components/task-editor";

type Filter = "all" | "today" | "overdue" | "upcoming" | "later";

function taskBucket(task: Task, today: string): Exclude<Filter, "all"> {
  if (task.later) return "later";
  const date = resolveTaskDate(task, new Date(`${today}T12:00:00`));
  if (!date || date === today) return "today";
  return date < today ? "overdue" : "upcoming";
}

function TaskRow({ task, onToggle, onEdit }: { task: Task; onToggle: () => void; onEdit: () => void }) {
  return <li className={`full-task-row ${task.status === "completed" ? "is-done" : ""}`}>
    <button onClick={onToggle} aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}>{task.status === "completed" ? <Check size={16} aria-hidden="true" /> : <Circle size={16} aria-hidden="true" />}</button>
    <span className={`priority-dot priority-${task.priority}`} aria-label={`${task.priority} priority`} />
    <div><span>{task.project}</span><h3>{task.title}</h3>{task.note ? <p>{task.note}</p> : null}</div>
    <time dateTime={task.dueDate}>{task.dueLabel}</time><small><Clock3 size={13} aria-hidden="true" /> {task.estimateMinutes} min</small>
    <button className="task-edit-button" onClick={onEdit} aria-label={`Edit ${task.title}`}><Pencil size={15} aria-hidden="true" /></button>
  </li>;
}

export function TasksView() {
  const { getWorkItems, hydrated, toggleTask, completeOccurrence, uncompleteOccurrence, skipOccurrence, rescheduleOccurrence, createTask, updateTask, deleteTask, canUndo, undoLast } = useRhythm();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [project, setProject] = useState("all");
  const [editorTask, setEditorTask] = useState<Task | "new" | null>(null);
  const [occurrenceTask, setOccurrenceTask] = useState<Task | null>(null);
  const today = toDateKey(new Date());
  const workItems = useMemo(() => getWorkItems(dateRangeFrom(new Date(), 365, 365)), [getWorkItems]);
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

  const openTasks = useMemo(() => workItems.filter((task) => task.status === "pending"), [workItems]);
  const completedTasks = useMemo(() => workItems.filter((task) => task.status === "completed"), [workItems]);
  const visibleTasks = useMemo(() => {
    const clean = query.trim().toLocaleLowerCase();
    return openTasks.filter((task) => {
      const matchesFilter = filter === "all" || taskBucket(task, today) === filter;
      const matchesQuery = !clean || `${task.title} ${task.project} ${task.note ?? ""}`.toLocaleLowerCase().includes(clean);
      const matchesProject = project === "all" || task.project === project;
      return matchesFilter && matchesQuery && matchesProject;
    });
  }, [filter, openTasks, project, query, today]);

  function saveTask(draft: TaskDraft) {
    if (editorTask === "new") createTask(draft);
    else if (editorTask) updateTask(editorTask.id, draft);
    setEditorTask(null);
  }

  function toggleWorkItem(task: Task) {
    if (task.generated && task.rhythmId && task.occurrenceDate) {
      const occurrence = { rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate };
      (task.status === "completed" ? uncompleteOccurrence : completeOccurrence)(occurrence);
    } else toggleTask(task.id);
  }

  if (!hydrated) return <div className="workspace-view"><div className="loading-panel"><Spinner label="Loading tasks" /><p>Preparing Tasks from your local workspace…</p></div></div>;

  const filterLabels: Array<[Filter, string]> = [["all", "All open"], ["today", "Today"], ["overdue", "Overdue"], ["upcoming", "Upcoming"], ["later", "Later"]];
  const filteredByControls = Boolean(query.trim() || project !== "all" || filter !== "all");

  return <div className="workspace-view tasks-view">
    <header className="workspace-header">
      <div><p className="eyebrow">A factual task inventory</p><h1>Tasks</h1><p className="page-subtitle">{openTasks.length} open · {completedTasks.length} completed · {openTasks.reduce((sum, task) => sum + task.estimateMinutes, 0)} minutes planned</p></div>
      <div className="workspace-header-actions">{canUndo ? <Button type="button" onClick={undoLast}>Undo last change</Button> : null}<Button variant="primary" onClick={() => setEditorTask("new")}><Plus size={17} aria-hidden="true" /> Add task</Button></div>
    </header>

    <section className="task-summary-line" aria-label="Task summary"><strong>{openTasks.length} open task{openTasks.length === 1 ? "" : "s"}</strong><span>{openTasks.reduce((sum, task) => sum + task.estimateMinutes, 0)} estimated minutes</span><span>Completed tasks are kept below.</span></section>

    <section className="workspace-panel tasks-panel">
      <div className="task-toolbar">
        <div className="filter-tabs" aria-label="Task views">{filterLabels.map(([value, label]) => <button key={value} type="button" className={filter === value ? "is-active" : ""} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <label className="task-search"><Search size={15} aria-hidden="true" /><span className="sr-only">Search tasks, projects, and notes</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, projects, notes" /></label>
        {projects.length > 1 ? <label className="project-filter"><span className="sr-only">Filter by project</span><select value={project} onChange={(event) => setProject(event.target.value)}><option value="all">All projects</option>{projects.map((name) => <option key={name} value={name}>{name}</option>)}</select></label> : null}
      </div>
      <div className="task-groups">
        {filterLabels.slice(1).map(([bucket, label]) => {
          const group = visibleTasks.filter((task) => taskBucket(task, today) === bucket);
          if (filter !== "all" && filter !== bucket) return null;
          return <section className="task-group" key={bucket} aria-labelledby={`task-group-${bucket}`}><div className="task-group__heading"><h2 id={`task-group-${bucket}`}>{label}</h2><span>{group.length}</span></div>{group.length ? <ol className="full-task-list" aria-label={`${label} tasks`}>{group.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleWorkItem(task)} onEdit={() => task.generated ? setOccurrenceTask(task) : setEditorTask(task)} />)}</ol> : <p className="task-group__empty">No {label.toLocaleLowerCase()} open tasks.</p>}</section>;
        })}
        {!visibleTasks.length && filteredByControls ? <EmptyState title="No tasks match these filters" description="Try another view, project, or search term." action={<Button type="button" onClick={() => { setFilter("all"); setProject("all"); setQuery(""); }}>Clear filters</Button>} /> : null}
        {!openTasks.length && !filteredByControls ? <EmptyState title="No open tasks" description="Add a task when something needs a place in your workspace." action={<Button type="button" variant="primary" onClick={() => setEditorTask("new")}>Add your first task</Button>} /> : null}
      </div>
    </section>

    <details className="completed-tasks"><summary>Completed <span>{completedTasks.length}</span></summary>{completedTasks.length ? <ol className="full-task-list">{completedTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={() => toggleWorkItem(task)} onEdit={() => task.generated ? setOccurrenceTask(task) : setEditorTask(task)} />)}</ol> : <p>No completed tasks yet.</p>}</details>

    {editorTask ? <TaskEditor key={editorTask === "new" ? "new" : editorTask.id} task={editorTask === "new" ? undefined : editorTask} onClose={() => setEditorTask(null)} onSave={saveTask} onDelete={editorTask === "new" ? undefined : () => { deleteTask(editorTask.id); setEditorTask(null); }} /> : null}
    {occurrenceTask?.rhythmId && occurrenceTask.occurrenceDate ? <OccurrenceActionSheet task={occurrenceTask} onClose={() => setOccurrenceTask(null)} onComplete={() => { completeOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onUncomplete={() => { uncompleteOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onSkip={() => { skipOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onReschedule={(date, time) => { rescheduleOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }, date, time); setOccurrenceTask(null); }} /> : null}
  </div>;
}
