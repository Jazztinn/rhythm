"use client";

import { FormEvent, useState } from "react";
import { CalendarDays, ChevronDown, Clock3, Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui";
import { BarrelTimePicker } from "@/components/barrel-time-picker";
import {
  resolveTaskDate,
  toDateKey,
  type Task,
  type TaskDraft,
  type TaskPriority,
} from "@/lib/rhythm";

type TaskEditorProps = {
  task?: Task;
  initialDraft?: Partial<TaskDraft>;
  onClose: () => void;
  onSave: (draft: TaskDraft) => void;
  onDelete?: () => void;
  dialogTitle?: string;
  submitLabel?: string;
};

export function TaskEditor({ task, initialDraft, onClose, onSave, onDelete, dialogTitle, submitLabel }: TaskEditorProps) {
  const [title, setTitle] = useState(task?.title ?? initialDraft?.title ?? "");
  const [project, setProject] = useState(task?.project ?? initialDraft?.project ?? "Personal");
  const [dueDate, setDueDate] = useState(
    task ? resolveTaskDate(task) ?? toDateKey(new Date()) : initialDraft?.dueDate ?? toDateKey(new Date()),
  );
  const [dueTime, setDueTime] = useState(task?.dueTime ?? initialDraft?.dueTime ?? "");
  const [estimateMinutes, setEstimateMinutes] = useState(task?.estimateMinutes ?? initialDraft?.estimateMinutes ?? 30);
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? initialDraft?.priority ?? "medium");
  const [later, setLater] = useState(task?.later ?? initialDraft?.later ?? false);
  const [note, setNote] = useState(task?.note ?? initialDraft?.note ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [moreOpen, setMoreOpen] = useState(Boolean(task));

  function setQuickTime(kind: "usual" | "now" | "later" | "evening") {
    const date = new Date();
    if (kind === "usual") return setDueTime("08:00");
    if (kind === "evening") return setDueTime("20:30");
    if (kind === "later") date.setMinutes(date.getMinutes() + 30);
    const roundedMinutes = Math.ceil(date.getMinutes() / 5) * 5;
    date.setMinutes(roundedMinutes, 0, 0);
    setDueTime(`${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`);
  }

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
    <Dialog open onClose={onClose} title={dialogTitle ?? (task ? "Task details" : "New task")} className="task-editor-dialog ron-task-editor-dialog">
      <form className="task-editor ron-task-editor" onSubmit={submit}>
        <div className="editor-scroll-body">
        <div className="ron-editor-intro">
          {task ? <span>Edit this task</span> : <span className="ron-editor-intro__spacer" aria-hidden="true" />}
          <label><span>Name</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="What needs doing?" maxLength={240} required /></label>
          <label><span>Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={320} placeholder="Add optional details" /></label>
        </div>

        <section className="ron-editor-section">
          <span className="section-kicker">Duration</span>
          <div className="duration-presets" role="group" aria-label="Estimated duration">{[15, 20, 35, 45, 60].map((minutes) => <button type="button" key={minutes} className={estimateMinutes === minutes ? "is-selected" : ""} aria-pressed={estimateMinutes === minutes} onClick={() => setEstimateMinutes(minutes)}>{minutes === 60 ? "1h" : `${minutes}m`}</button>)}</div>
        </section>

        <section className="ron-editor-section">
          <span className="section-kicker">Time</span>
          <div className="time-shortcuts"><button type="button" className={dueTime === "08:00" ? "is-active" : ""} onClick={() => setQuickTime("usual")}>Usual: 8:00 AM</button><button type="button" onClick={() => setQuickTime("now")}>Now</button><button type="button" onClick={() => setQuickTime("later")}>+30 min</button><button type="button" onClick={() => setQuickTime("evening")}>This evening</button></div>
          <div className="optional-time-control"><button type="button" aria-pressed={!dueTime} onClick={() => setDueTime("")}>Any time</button>{dueTime ? <button type="button" onClick={() => setDueTime("")}>Clear</button> : <button type="button" onClick={() => setDueTime("12:00")}>Set time</button>}</div>
          {dueTime ? <BarrelTimePicker value={dueTime} onChange={setDueTime} /> : null}
        </section>

        <button className="ron-more-toggle" type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((open) => !open)}><span><CalendarDays size={15} /> Project, date & priority</span><ChevronDown size={16} /></button>
        {moreOpen ? <div className="editor-grid ron-editor-more">
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
          <label className="editor-check">
            <input type="checkbox" checked={later} onChange={(event) => setLater(event.target.checked)} />
            <span>Keep in Later</span>
          </label>
        </div> : null}

        </div>
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
            <button className="primary-button ron-save-task" type="submit" disabled={!title.trim()}><Clock3 size={15} />{submitLabel ?? (task ? "Save task" : "Add task")}</button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
