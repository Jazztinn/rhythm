"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import { Check, Circle, Clock3, ListFilter, Pencil, Plus, RotateCcw, Search, Sparkles } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { TaskEditor } from "@/components/task-editor";
import type { Task, TaskDraft, TaskStatus } from "@/lib/rhythm";

type Filter = "all" | TaskStatus;

export function TasksView() {
  const root = useRef<HTMLDivElement>(null);
  const { tasks, toggleTask, createTask, updateTask, deleteTask, undo, canUndo } = useRhythm();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [editorTask, setEditorTask] = useState<Task | "new" | null>(null);

  const visibleTasks = useMemo(() => {
    const clean = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesFilter = filter === "all" || task.status === filter;
      const matchesQuery = !clean || `${task.title} ${task.project}`.toLowerCase().includes(clean);
      return matchesFilter && matchesQuery;
    });
  }, [filter, query, tasks]);

  const pending = tasks.filter((task) => task.status === "pending");
  const focusedMinutes = pending.reduce((sum, task) => sum + task.estimateMinutes, 0);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from("[data-workspace-reveal]", { opacity: 0, y: 18, duration: 0.7, stagger: 0.07, ease: "power3.out" });
      gsap.to(".tasks-glow", { xPercent: 9, yPercent: -5, duration: 8, repeat: -1, yoyo: true, ease: "sine.inOut" });
    }, root);
    return () => context.revert();
  }, []);

  function saveTask(draft: TaskDraft) {
    if (editorTask === "new") createTask(draft);
    else if (editorTask) updateTask(editorTask.id, draft);
    setEditorTask(null);
  }

  return (
    <div className="workspace-view" ref={root}>
      <header className="workspace-header" data-workspace-reveal>
        <div><p className="eyebrow">Everything in one place</p><h1>Tasks</h1><p className="page-subtitle">A quiet inventory of what deserves your attention.</p></div>
        <div className="workspace-header-actions">
          {canUndo ? <button className="soft-button" onClick={undo}><RotateCcw size={15} /> Undo</button> : null}
          <button className="primary-button" onClick={() => setEditorTask("new")}><Plus size={17} /> Add task</button>
        </div>
      </header>

      <section className="tasks-summary" data-workspace-reveal>
        <article className="metric-card metric-card--lime">
          <span className="tasks-glow" aria-hidden="true" />
          <div className="metric-top"><span>Open tasks</span><i>Today</i></div>
          <strong>{String(pending.length).padStart(2, "0")}</strong>
          <p>{pending.length <= 4 ? "Your list feels breathable." : "Choose three. Let the rest wait."}</p>
        </article>
        <article className="metric-card metric-card--peach"><div className="metric-top"><span>Planned focus</span><Clock3 size={16} /></div><strong>{Math.floor(focusedMinutes / 60)}<small>h</small> {focusedMinutes % 60}<small>m</small></strong><p>Across every open task.</p></article>
        <article className="metric-card metric-card--paper"><div className="metric-top"><span>Completion</span><Sparkles size={16} /></div><strong>{tasks.length ? Math.round(((tasks.length - pending.length) / tasks.length) * 100) : 100}<small>%</small></strong><p>Small progress still counts.</p></article>
      </section>

      <section className="workspace-panel" data-workspace-reveal>
        <div className="task-toolbar">
          <div className="filter-tabs" aria-label="Filter tasks">
            {(["all", "pending", "completed"] as Filter[]).map((value) => <button key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{value}</button>)}
          </div>
          <label className="task-search"><Search size={15} /><span className="sr-only">Search tasks</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks" /></label>
        </div>
        <div className="full-task-list">
          {visibleTasks.map((task) => (
            <article className={`full-task-row ${task.status === "completed" ? "is-done" : ""}`} key={task.id}>
              <button onClick={() => toggleTask(task.id)} aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`}>{task.status === "completed" ? <Check size={16} /> : <Circle size={16} />}</button>
              <span className={`priority-dot priority-${task.priority}`} />
              <div><span>{task.project}</span><h2>{task.title}</h2></div>
              <p>{task.dueLabel}</p><small><Clock3 size={13} /> {task.estimateMinutes} min</small>
              <button className="task-edit-button" onClick={() => setEditorTask(task)} aria-label={`Edit ${task.title}`}><Pencil size={15} /></button>
            </article>
          ))}
          {!visibleTasks.length ? <div className="empty-filter"><ListFilter size={18} /> No tasks match this view.</div> : null}
        </div>
      </section>

      {editorTask ? (
        <TaskEditor
          key={editorTask === "new" ? "new" : editorTask.id}
          task={editorTask === "new" ? undefined : editorTask}
          onClose={() => setEditorTask(null)}
          onSave={saveTask}
          onDelete={editorTask === "new" ? undefined : () => {
            deleteTask(editorTask.id);
            setEditorTask(null);
          }}
        />
      ) : null}
    </div>
  );
}
