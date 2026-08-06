"use client";

import { FormEvent, useState } from "react";
import { CalendarClock, Check, Clock3, RotateCcw, SkipForward } from "lucide-react";
import { Sheet, Button } from "@/components/ui";
import type { Task } from "@/lib/rhythm";

type OccurrenceActionSheetProps = {
  task: Task;
  onClose: () => void;
  onComplete: () => void;
  onUncomplete: () => void;
  onSkip: () => void;
  onReschedule: (date: string, time: string) => void;
};

export function OccurrenceActionSheet({ task, onClose, onComplete, onUncomplete, onSkip, onReschedule }: OccurrenceActionSheetProps) {
  const [date, setDate] = useState(task.dueDate ?? task.occurrenceDate ?? "");
  const [time, setTime] = useState(task.dueTime ?? "");

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!date) return;
    onReschedule(date, time);
  }

  return <Sheet open onClose={onClose} title="Rhythm occurrence" className="occurrence-sheet">
    <div className="occurrence-sheet__intro">
      <span className="provenance-pill"><RotateCcw size={13} aria-hidden="true" /> From Rhythm</span>
      <h3>{task.title}</h3>
      <p>{task.project} · {task.estimateMinutes} min · {task.dueLabel}</p>
      {task.note ? <small>{task.note}</small> : null}
    </div>
    <div className="occurrence-actions">
      <Button type="button" variant="primary" onClick={task.status === "completed" ? onUncomplete : onComplete}><Check size={15} aria-hidden="true" />{task.status === "completed" ? "Mark open" : "Complete occurrence"}</Button>
      <Button type="button" onClick={onSkip}><SkipForward size={15} aria-hidden="true" /> Skip this occurrence</Button>
    </div>
    <form className="occurrence-reschedule" onSubmit={submit}>
      <div><span className="section-kicker"><CalendarClock size={14} aria-hidden="true" /> One-off reschedule</span><p>Only this occurrence moves. The rhythm stays unchanged.</p></div>
      <div className="editor-grid">
        <label className="editor-field"><span>Date</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></label>
        <label className="editor-field"><span>Time (optional)</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
      </div>
      <Button type="submit"><Clock3 size={15} aria-hidden="true" /> Reschedule once</Button>
    </form>
  </Sheet>;
}
