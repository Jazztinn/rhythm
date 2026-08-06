"use client";

import { FormEvent, useEffect, useState } from "react";
import { Trash2, X } from "lucide-react";
import {
  resolveTaskDate,
  toDateKey,
  type Task,
  type TaskDraft,
  type TaskPriority,
} from "@/lib/rhythm";

type TaskEditorProps = {
  task?: Task;
  onClose: () => void;
  onSave: (draft: TaskDraft) => void;
  onDelete?: () => void;
};

export function TaskEditor({ task, onClose, onSave, onDelete }: TaskEditorProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [project, setProject] = useState(task?.project ?? "Personal");
  const [dueDate, setDueDate] = useState(
    task ? resolveTaskDate(task) ?? toDateKey(new Date()) : toDateKey(new Date()),
  );
  const [dueTime, setDueTime] = useState(task?.dueTime ?? "");
  const [estimateMinutes, setEstimateMinutes] = useState(task?.estimateMinutes ?? 25);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [later, setLater] = useState(task?.later ?? false);
  const [note, setNote] = useState(task?.note ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    onSave({
      title,
      project,
      dueDate,
      dueTime,
      estimateMinutes,
      priority,
      later,
      note,
    });
  }

  return (
    <div className="quick-add-backdrop" role="presentation" onMouseDown={onClose}>
      <form
        className="quick-add task-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-editor-title"
        onSubmit={submit}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="editor-heading">
          <div>
            <span className="section-kicker">{task ? "Edit task" : "New task"}</span>
            <h2 id="task-editor-title">{task ? "Shape the next step." : "What needs doing?"}</h2>
          </div>
          <button className="editor-close" type="button" onClick={onClose} aria-label="Close task editor">
            <X size={17} />
          </button>
        </div>

        <label className="editor-field editor-field--wide">
          <span>Task</span>
          <input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Write the task clearly" maxLength={240} required />
        </label>

        <div className="editor-grid">
          <label className="editor-field">
            <span>Project</span>
            <input value={project} onChange={(event) => setProject(event.target.value)} maxLength={120} />
          </label>
          <label className="editor-field">
            <span>Priority</span>
            <select value={priority} onChange={(event) => setPriority(event.target.value as TaskPriority)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className="editor-field">
            <span>Date</span>
            <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} required />
          </label>
          <label className="editor-field">
            <span>Time (optional)</span>
            <input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} />
          </label>
          <label className="editor-field">
            <span>Estimate</span>
            <select value={estimateMinutes} onChange={(event) => setEstimateMinutes(Number(event.target.value))}>
              {[10, 15, 25, 30, 45, 60, 90, 120].map((minutes) => <option key={minutes} value={minutes}>{minutes} min</option>)}
            </select>
          </label>
          <label className="editor-check">
            <input type="checkbox" checked={later} onChange={(event) => setLater(event.target.checked)} />
            <span>Keep in Later</span>
          </label>
        </div>

        <label className="editor-field editor-field--wide">
          <span>Note (optional)</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={320} placeholder="Useful context, not extra pressure" />
        </label>

        <div className="editor-actions">
          {onDelete ? (
            confirmingDelete ? (
              <div className="delete-confirm">
                <span>Delete this task?</span>
                <button type="button" onClick={() => setConfirmingDelete(false)}>Keep</button>
                <button type="button" className="danger-button" onClick={onDelete}>Delete</button>
              </div>
            ) : (
              <button type="button" className="delete-button" onClick={() => setConfirmingDelete(true)}>
                <Trash2 size={15} /> Delete task
              </button>
            )
          ) : <span />}
          <div>
            <button type="button" className="soft-button" onClick={onClose}>Cancel</button>
            <button className="primary-button" type="submit" disabled={!title.trim()}>{task ? "Save changes" : "Add task"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
