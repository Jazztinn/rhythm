"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, MoveRight, Pencil, RotateCcw, SkipForward, X } from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";
import { Sheet } from "@/components/ui";
import { BarrelTimePicker, parseBarrelTime } from "@/components/barrel-time-picker";
import { toDateKey, type Task } from "@/lib/rhythm";

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
  const [detailsOpen, setDetailsOpen] = useState(true);
  const [time, setTime] = useState(task.dueTime ?? "09:00");
  const [title, setTitle] = useState(task.title);
  const [note, setNote] = useState(task.note ?? "");
  const [estimateMinutes, setEstimateMinutes] = useState(task.estimateMinutes);
  const rhythmTitle = rhythms.find((rhythm) => rhythm.id === task.rhythmId)?.title ?? task.title;
  const meta = useMemo(() => {
    const { hour, minute, period } = parseBarrelTime(time);
    return `${task.project} · ${estimateMinutes} min · ${task.dueLabel} · ${hour}:${String(minute).padStart(2, "0")} ${period}`;
  }, [estimateMinutes, task.dueLabel, task.project, time]);

  function saveOccurrence() {
    if (!task.rhythmId || !task.occurrenceDate || !title.trim()) return;
    editOccurrence({ rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate }, { title: title.trim(), note: note.trim(), estimateMinutes, localTime: time });
    onClose();
  }

  function moveToTomorrow() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    onReschedule(toDateKey(tomorrow), time);
  }

  function setShortcut(kind: "usual" | "now" | "later" | "evening") {
    if (kind === "usual") return setTime(task.dueTime ?? "08:00");
    if (kind === "evening") return setTime("20:30");
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes() + (kind === "later" ? 30 : 0);
    setTime(`${String(Math.floor((minutes % 1440) / 60)).padStart(2, "0")}:${String(Math.round((minutes % 60) / 5) * 5 % 60).padStart(2, "0")}`);
  }

  return <Sheet open onClose={onClose} title="Rhythm occurrence" labelledBy="occurrence-title" hideHeading className="occurrence-sheet occurrence-reference">
    <button type="button" className="occurrence-reference__close" aria-label="Close occurrence" onClick={onClose}><X size={16} aria-hidden="true" /></button>
    <h2 id="occurrence-title" className="occurrence-reference__heading">Rhythm occurrence</h2>
    <div className="occurrence-sheet__intro">
      <span className="provenance-pill"><RotateCcw size={13} aria-hidden="true" /> From Rhythm · {rhythmTitle}</span>
      <h3 contentEditable suppressContentEditableWarning onBlur={(event) => setTitle(event.currentTarget.textContent?.trim() || "Untitled Occurrence")}>{title}</h3>
      <p>{meta}</p>
      <small contentEditable suppressContentEditableWarning onBlur={(event) => setNote(event.currentTarget.textContent?.trim() ?? "")}>{note}</small>
    </div>
    <div className="occurrence-actions" aria-label="Occurrence actions">
      <button type="button" className="occurrence-action occurrence-action--primary" onClick={task.status === "completed" ? onUncomplete : onComplete}><Check size={15} aria-hidden="true" />{task.status === "completed" ? "Mark open" : "Complete"}</button>
      <button type="button" className="occurrence-action" onClick={onSkip}><SkipForward size={15} aria-hidden="true" /> Skip</button>
      <button type="button" className="occurrence-action" onClick={moveToTomorrow}><MoveRight size={15} aria-hidden="true" /> Move</button>
      <button type="button" className="occurrence-action occurrence-action--details" aria-expanded={detailsOpen} onClick={() => setDetailsOpen((open) => !open)}><Pencil size={14} aria-hidden="true" /> Details</button>
    </div>
    {detailsOpen ? <section className="occurrence-details">
      <div className="occurrence-details__heading"><strong>Only this occurrence</strong><p>Future occurrences keep the Rhythm defaults.</p></div>
      <label className="occurrence-field"><span>Name</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} required /></label>
      <label className="occurrence-field"><span>Note</span><input value={note} onChange={(event) => setNote(event.target.value)} maxLength={240} /></label>
      <div><span className="occurrence-field__label">Duration</span><div className="duration-presets" role="group" aria-label="Estimated duration">{[15, 30, 45, 60, 90].map((minutes) => <button type="button" key={minutes} className={estimateMinutes === minutes ? "is-selected" : ""} aria-pressed={estimateMinutes === minutes} onClick={() => setEstimateMinutes(minutes)}>{minutes < 60 ? `${minutes}m` : minutes === 60 ? "1h" : "1.5h"}</button>)}</div></div>
      <div className="occurrence-time"><span className="occurrence-field__label">Time</span><div className="time-shortcuts"><button type="button" onClick={() => setShortcut("usual")}>Usual: {task.dueTime ?? "8:00 AM"}</button><button type="button" onClick={() => setShortcut("now")}>Now</button><button type="button" onClick={() => setShortcut("later")}>+30 min</button><button type="button" onClick={() => setShortcut("evening")}>This Evening</button></div><BarrelTimePicker value={time} onChange={setTime} /></div>
      <button type="button" className="occurrence-save" onClick={saveOccurrence}>Save this occurrence <ChevronRight size={15} aria-hidden="true" /></button>
    </section> : null}
  </Sheet>;
}
