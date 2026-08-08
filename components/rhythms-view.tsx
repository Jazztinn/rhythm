"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { Check, Flame, Moon, Orbit, Plus, Sparkles, Sun, Waves } from "lucide-react";

const RHYTHM_KEY = "rhythm.routines.v1";
const routines = [
  { id: "morning", title: "Start softly", note: "Water, sunlight, no inbox", time: "8:00 AM", icon: Sun, tone: "lime" },
  { id: "focus", title: "Protect one deep block", note: "One important thing, fully present", time: "10:00 AM", icon: Waves, tone: "violet" },
  { id: "shutdown", title: "Close the loops", note: "Review, reset, step away", time: "8:30 PM", icon: Moon, tone: "peach" },
];

export function RhythmsView() {
  const root = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const parsed: unknown = JSON.parse(window.localStorage.getItem(RHYTHM_KEY) || "[]");
        setDone(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && routines.some((routine) => routine.id === item)) : []);
      } catch {
        window.localStorage.removeItem(RHYTHM_KEY);
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(RHYTHM_KEY, JSON.stringify(done)); }, [done, hydrated]);

  useLayoutEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const context = gsap.context(() => {
      gsap.from("[data-workspace-reveal]", { opacity: 0, y: 18, duration: 0.72, stagger: 0.08, ease: "power3.out" });
      gsap.to(".rhythm-orbit-ring", { rotate: 360, duration: 28, repeat: -1, ease: "none" });
    }, root);
    return () => context.revert();
  }, []);

  const score = Math.round((done.length / routines.length) * 100);
  const toggle = (id: string) => setDone((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);

  return (
    <div className="workspace-view" ref={root}>
      <header className="workspace-header" data-workspace-reveal><div><p className="eyebrow">Repeat what restores you</p><h1>Rhythms</h1><p className="page-subtitle">Gentle structure for days that still feel human.</p></div><Link className="primary-button" href="/chat?prompt=Help%20me%20create%20a%20new%20daily%20rhythm."><Plus size={17} /> New rhythm</Link></header>
      <section className="rhythm-hero" data-workspace-reveal>
        <div className="rhythm-orbit" aria-hidden="true"><span className="rhythm-orbit-ring"><i /><i /><i /></span><strong>{score}<small>%</small></strong></div>
        <div><span className="section-kicker"><Orbit size={15} /> Today&apos;s flow</span><h2>{done.length === routines.length ? "You kept every promise to yourself." : "Consistency, without pressure."}</h2><p>{done.length} of {routines.length} rhythms complete. Missing one never breaks the chain.</p><div className="streak"><Flame size={18} /><strong>12 day gentle streak</strong><span>Best: 21 days</span></div></div>
      </section>
      <section className="rhythm-layout">
        <div className="routine-list" data-workspace-reveal>
          <div className="section-heading"><div><span className="section-kicker">Daily anchors</span><h2>Move through the day</h2></div><span>{done.length}/{routines.length} complete</span></div>
          {routines.map((routine) => { const Icon = routine.icon; const complete = done.includes(routine.id); return <article className={`routine-card tone-${routine.tone} ${complete ? "is-complete" : ""}`} key={routine.id}><span className="routine-icon"><Icon size={19} /></span><div><small>{routine.time}</small><h3>{routine.title}</h3><p>{routine.note}</p></div><button onClick={() => toggle(routine.id)} aria-label={`${complete ? "Undo" : "Complete"} ${routine.title}`}>{complete ? <Check size={17} /> : <span />}</button></article>; })}
        </div>
        <aside className="rhythm-insight" data-workspace-reveal><span className="section-kicker"><Sparkles size={14} /> Pattern noticed</span><h2>Your calmest days start offline.</h2><p>When “Start softly” happens before 8:30 AM, you complete 24% more meaningful work—and finish earlier.</p><div className="insight-chart">{[42, 56, 49, 72, 64, 84, 76].map((height, index) => <span key={index}><i style={{ height: `${height}%` }} /><small>{"MTWTFSS"[index]}</small></span>)}</div></aside>
      </section>
    </div>
  );
}
