"use client";

import { FormEvent, useState } from "react";
import { CalendarClock, Check, Clock3, RotateCcw, SkipForward } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
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
  const { rhythms, editOccurrence } = useRhythm();
  const [date, setDate] = useState(task.dueDate ?? task.occurrenceDate ?? "");
  const [time, setTime] = useState(task.dueTime ?? "");
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const [estimateMinutes, setEstimateMinutes] = useState(task.estimateMinutes);
  const rhythmTitle = rhythms.find((rhythm) => rhythm.id === task.rhythmId)?.title ?? task.title;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!date) return;
    onReschedule(date, time);
  }

  function submitEdit(event: FormEvent) {
    event.preventDefault();
    if (!task.rhythmId || !task.occurrenceDate || !title.trim()) return;
    editOccurrence(
      { rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate },
      { title: title.trim(), note: note.trim(), estimateMinutes, localTime: time },
    );
    onClose();
  }

  return <Sheet open onClose={onClose} title="Rhythm occurrence" className="occurrence-sheet">
    <div className="occurrence-sheet__intro">
      <span className="provenance-pill"><RotateCcw size={13} aria-hidden="true" /> From Rhythm · {rhythmTitle}</span>
      <h3>{task.title}</h3>
      <p>{task.project} · {task.estimateMinutes} min · {task.dueLabel}</p>
      {task.note ? <small>{task.note}</small> : null}
    </div>
    <div className="occurrence-actions">
      <Button type="button" variant="primary" onClick={task.status === "completed" ? onUncomplete : onComplete}><Check size={15} aria-hidden="true" />{task.status === "completed" ? "Mark open" : "Complete occurrence"}</Button>
      <Button type="button" onClick={onSkip}><SkipForward size={15} aria-hidden="true" /> Skip this occurrence</Button>
      <Button type="button" onClick={() => setEditing((current) => !current)}>Edit only this occurrence</Button>
    </div>
    {editing ? <form className="occurrence-reschedule" onSubmit={submitEdit}>
      <div><span className="section-kicker">Occurrence details</span><p>These changes stay with this date. Future occurrences keep the Rhythm defaults.</p></div>
      <label className="editor-field"><span>Name</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
      <label className="editor-field"><span>Note</span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} /></label>
      <div className="editor-grid">
        <label className="editor-field"><span>Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
        <label className="editor-field"><span>Estimate</span><input type="number" min="5" max="480" step="5" value={estimateMinutes} onChange={(event) => setEstimateMinutes(Number(event.target.value))} /></label>
      </div>
      <Button type="submit">Save this occurrence</Button>
    </form> : null}
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
