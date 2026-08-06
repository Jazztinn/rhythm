"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare2,
  MessageCircleMore,
  Orbit,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { useRhythm } from "@/components/rhythm-provider";

const navigation = [
  { label: "Today", href: "/", icon: CheckSquare2, enabled: true },
  { label: "Chat", href: "/chat", icon: MessageCircleMore, enabled: true },
  { label: "Tasks", href: "/tasks", icon: Sparkles, enabled: true },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, enabled: true },
  { label: "Rhythms", href: "/rhythms", icon: Orbit, enabled: true },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  const { tasks, toggleTask, reset } = useRhythm();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useLayoutEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    const activeItem = navigationRef.current?.querySelector<HTMLElement>(".nav-item.is-active");
    activeItem?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  const searchResults = useMemo(() => {
    const clean = query.trim().toLowerCase();
    if (!clean) return tasks.slice(0, 6);
    return tasks.filter((task) => `${task.title} ${task.project} ${task.note ?? ""}`.toLowerCase().includes(clean)).slice(0, 8);
  }, [query, tasks]);
  const completed = tasks.filter((task) => task.status === "completed").length;

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link href="/" className="brand" aria-label="Rhythm home">
          <span className="brand-mark">R</span>
          <span className="brand-name">rhythm</span>
        </Link>

        <nav className="nav-stack" ref={navigationRef}>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

            if (!item.enabled) {
              return (
                <span
                  key={item.label}
                  className="nav-item is-disabled"
                  aria-disabled="true"
                  title={`${item.label} — coming next`}
                >
                  <Icon size={19} strokeWidth={1.7} />
                  <span>{item.label}</span>
                  <i>Soon</i>
                </span>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={`nav-item ${active ? "is-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="icon-button" aria-label="Search Rhythm" onClick={() => { setSearchOpen(true); setProfileOpen(false); }} title="Search (⌘K)">
            <Search size={18} strokeWidth={1.7} />
          </button>
          <button className="profile-button" aria-label="Open profile" aria-expanded={profileOpen} onClick={() => { setProfileOpen((open) => !open); setSearchOpen(false); }}>
            <span>JT</span>
            <i />
          </button>
          {profileOpen ? (
            <div className="profile-popover">
              <span className="section-kicker">Local workspace</span>
              <strong>Jazz Tinn</strong>
              <p>{tasks.length - completed} open · {completed} complete</p>
              <div><Link href="/tasks" onClick={() => setProfileOpen(false)}>Manage tasks</Link><button onClick={() => { reset(); setProfileOpen(false); }}>Restore starter data</button></div>
            </div>
          ) : null}
        </div>
      </aside>
      <main className="app-content">
        <ViewTransition default="page-crossfade">{children}</ViewTransition>
      </main>
      <div className="grain" aria-hidden="true" />
      {searchOpen ? (
        <div className="search-backdrop" role="presentation" onMouseDown={() => setSearchOpen(false)}>
          <section className="search-dialog" role="dialog" aria-modal="true" aria-labelledby="search-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="search-input-row">
              <Search size={19} />
              <label className="sr-only" htmlFor="rhythm-search">Search tasks</label>
              <input id="rhythm-search" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, projects, notes…" />
              <button onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={17} /></button>
            </div>
            <div className="search-results">
              <span className="section-kicker" id="search-title">{query ? "Matches" : "Recent tasks"}</span>
              {searchResults.map((task) => (
                <article key={task.id}>
                  <button className={`search-check ${task.status === "completed" ? "is-complete" : ""}`} onClick={() => toggleTask(task.id)} aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`} />
                  <Link href="/tasks" onClick={() => setSearchOpen(false)}><strong>{task.title}</strong><span>{task.project} · {task.dueLabel}</span></Link>
                </article>
              ))}
              {!searchResults.length ? <p className="search-empty">Nothing found. Try task title or project.</p> : null}
            </div>
            <footer><span>↵ Open tasks</span><span>⌘K Toggle search</span></footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}
