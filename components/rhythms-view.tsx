"use client";

import { FormEvent, useEffect, useLayoutEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { Check, Flame, Moon, Orbit, Plus, Sparkles, Sun, Trash2, Waves, X } from "lucide-react";
import { toDateKey } from "@/lib/rhythm";

const RHYTHM_KEY = "rhythm.routines.v2";
type RoutineTone = "lime" | "violet" | "peach";
type RoutineIcon = "sun" | "waves" | "moon" | "orbit";
type Routine = { id: string; title: string; note: string; time: string; icon: RoutineIcon; tone: RoutineTone };
type SavedRhythms = { date: string; routines: Routine[]; done: string[] };

const defaultRoutines: Routine[] = [
  { id: "morning", title: "Start softly", note: "Water, sunlight, no inbox", time: "08:00", icon: "sun", tone: "lime" },
  { id: "focus", title: "Protect one deep block", note: "One important thing, fully present", time: "10:00", icon: "waves", tone: "violet" },
  { id: "shutdown", title: "Close the loops", note: "Review, reset, step away", time: "20:30", icon: "moon", tone: "peach" },
];
const icons = { sun: Sun, waves: Waves, moon: Moon, orbit: Orbit };

function isRoutine(value: unknown): value is Routine {
  if (!value || typeof value !== "object") return false;
  const routine = value as Routine;
  return typeof routine.id === "string" && typeof routine.title === "string" && typeof routine.note === "string" && typeof routine.time === "string";
}

function formatRoutineTime(time: string) {
  return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(`2026-01-01T${time}:00`));
}

export function RhythmsView() {
  const root = useRef<HTMLDivElement>(null);
  const [routines, setRoutines] = useState<Routine[]>(defaultRoutines);
  const [done, setDone] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [time, setTime] = useState("09:00");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(RHYTHM_KEY) || "null");
        if (parsed && typeof parsed === "object") {
          const saved = parsed as Partial<SavedRhythms>;
          if (Array.isArray(saved.routines)) setRoutines(saved.routines.filter(isRoutine));
          if (saved.date === toDateKey(new Date()) && Array.isArray(saved.done)) {
            setDone(saved.done.filter((id): id is string => typeof id === "string"));
          }
        }
      } catch {
        window.localStorage.removeItem(RHYTHM_KEY);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(RHYTHM_KEY, JSON.stringify({ date: toDateKey(new Date()), routines, done } satisfies SavedRhythms));
  }, [done, hydrated, routines]);

  useEffect(() => {
    if (!adding) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setAdding(false);
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [adding]);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from("[data-workspace-reveal]", { opacity: 0, y: 18, duration: 0.72, stagger: 0.08, ease: "power3.out" });
      gsap.to(".rhythm-orbit-ring", { rotate: 360, duration: 28, repeat: -1, ease: "none" });
    }, root);
    return () => context.revert();
  }, []);

  const score = routines.length ? Math.round((done.length / routines.length) * 100) : 100;
  const toggle = (id: string) => setDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  function addRoutine(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setRoutines((current) => [...current, {
      id: `routine-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      note: note.trim() || "A small promise worth keeping",
      time,
      icon: "orbit",
      tone: (["lime", "violet", "peach"] as RoutineTone[])[current.length % 3],
    }]);
    setTitle("");
    setNote("");
    setAdding(false);
  }

  function deleteRoutine(id: string) {
    setRoutines((current) => current.filter((routine) => routine.id !== id));
    setDone((current) => current.filter((item) => item !== id));
  }

  return (
    <div className="workspace-view" ref={root}>
      <header className="workspace-header" data-workspace-reveal>
        <div><p className="eyebrow">Repeat what restores you</p><h1>Rhythms</h1><p className="page-subtitle">Gentle structure for days that still feel human.</p></div>
        <button className="primary-button" onClick={() => setAdding(true)}><Plus size={17} /> New rhythm</button>
      </header>
      <section className="rhythm-hero" data-workspace-reveal>
        <div className="rhythm-orbit" aria-hidden="true"><span className="rhythm-orbit-ring"><i /><i /><i /></span><strong>{score}<small>%</small></strong></div>
        <div><span className="section-kicker"><Orbit size={15} /> Today&apos;s flow</span><h2>{routines.length === 0 ? "Make space for one gentle anchor." : done.length === routines.length ? "You kept every promise to yourself." : "Consistency, without pressure."}</h2><p>{done.length} of {routines.length} rhythms complete. Tomorrow starts fresh automatically.</p><div className="streak"><Flame size={18} /><strong>{done.length ? `${done.length} anchor${done.length === 1 ? "" : "s"} kept today` : "Your first anchor is waiting"}</strong><span>{score}% complete</span></div></div>
      </section>
      <section className="rhythm-layout">
        <div className="routine-list" data-workspace-reveal>
          <div className="section-heading"><div><span className="section-kicker">Daily anchors</span><h2>Move through the day</h2></div><span>{done.length}/{routines.length} complete</span></div>
          {routines.map((routine) => {
            const Icon = icons[routine.icon] ?? Orbit;
            const complete = done.includes(routine.id);
            return <article className={`routine-card tone-${routine.tone} ${complete ? "is-complete" : ""}`} key={routine.id}>
              <span className="routine-icon"><Icon size={19} /></span>
              <div><small>{formatRoutineTime(routine.time)}</small><h3>{routine.title}</h3><p>{routine.note}</p></div>
              <div className="routine-actions">
                <button onClick={() => deleteRoutine(routine.id)} aria-label={`Delete ${routine.title}`}><Trash2 size={14} /></button>
                <button onClick={() => toggle(routine.id)} aria-label={`${complete ? "Undo" : "Complete"} ${routine.title}`}>{complete ? <Check size={17} /> : <span />}</button>
              </div>
            </article>;
          })}
          {!routines.length ? <button className="empty-routines" onClick={() => setAdding(true)}><Plus size={17} /> Add your first daily anchor</button> : null}
        </div>
        <aside className="rhythm-insight" data-workspace-reveal><span className="section-kicker"><Sparkles size={14} /> Live reflection</span><h2>{done.length ? "Momentum comes from keeping one small promise." : "Pick the easiest anchor first."}</h2><p>{done.length ? `${done.length} complete today. Rhythm measures this device only—no invented streaks, no pressure.` : "Completion resets each day. Your routines stay until you change them."}</p><div className="insight-chart">{routines.slice(0, 7).map((routine) => <span key={routine.id}><i style={{ height: done.includes(routine.id) ? "88%" : "28%" }} /><small>{routine.time.slice(0, 2)}</small></span>)}</div></aside>
      </section>

      {adding ? (
        <div className="quick-add-backdrop" role="presentation" onMouseDown={() => setAdding(false)}>
          <form className="quick-add routine-editor" role="dialog" aria-modal="true" aria-labelledby="routine-editor-title" onSubmit={addRoutine} onMouseDown={(event) => event.stopPropagation()}>
            <div className="editor-heading"><div><span className="section-kicker">New rhythm</span><h2 id="routine-editor-title">What should return each day?</h2></div><button className="editor-close" type="button" onClick={() => setAdding(false)} aria-label="Close rhythm editor"><X size={17} /></button></div>
            <label className="editor-field editor-field--wide"><span>Name</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Walk before opening email" maxLength={120} required /></label>
            <div className="editor-grid"><label className="editor-field"><span>Time</span><input type="time" value={time} onChange={(event) => setTime(event.target.value)} required /></label><label className="editor-field"><span>Note</span><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Why this helps" maxLength={180} /></label></div>
            <div className="editor-actions"><span /><div><button type="button" className="soft-button" onClick={() => setAdding(false)}>Cancel</button><button className="primary-button" disabled={!title.trim()}>Add rhythm</button></div></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
