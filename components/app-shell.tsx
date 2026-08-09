"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, ViewTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CheckSquare2, MessageCircleMore, Orbit, Search, Sparkles, X } from "lucide-react";
import { TaskEditor } from "@/components/task-editor";
import { OccurrenceActionSheet } from "@/components/occurrence-action-sheet";
import { ConfirmAction, Dialog, StatusMessage, Toast } from "@/components/ui";
import { useRhythm } from "@/components/rhythm-provider";
import { dateRangeFrom, searchTasks, type Task, type TaskDraft } from "@/lib/rhythm";

const navigation = [
  { label: "Today", href: "/", icon: CheckSquare2 },
  { label: "Chat", href: "/chat", icon: MessageCircleMore },
  { label: "Tasks", href: "/tasks", icon: Sparkles },
  { label: "Calendar", href: "/calendar", icon: CalendarDays },
  { label: "Rhythms", href: "/rhythms", icon: Orbit },
];

function SearchDialog({ open, onClose, onOpenTask }: { open: boolean; onClose: () => void; onOpenTask: (task: Task) => void }) {
  const { getWorkItems, completeOccurrence, uncompleteOccurrence } = useRhythm();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const results = useMemo(() => searchTasks(getWorkItems(dateRangeFrom(new Date(), 30, 14)), query), [getWorkItems, query]);
  const safeActiveIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && results[safeActiveIndex]) {
      event.preventDefault();
      onOpenTask(results[safeActiveIndex]);
    }
  }

  return <Dialog open={open} onClose={onClose} title="Search your workspace" className="search-dialog-shell">
    <div className="search-input-row">
      <Search size={19} aria-hidden="true" />
      <label className="sr-only" htmlFor="rhythm-search">Search tasks, projects, and notes</label>
      <input
        id="rhythm-search"
        role="combobox"
        aria-autocomplete="list"
        aria-controls="rhythm-search-results"
        aria-expanded="true"
        aria-activedescendant={results[safeActiveIndex] ? `search-result-${results[safeActiveIndex].id}` : undefined}
        autoFocus
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Search tasks, projects, notes…"
      />
    </div>
    <div id="rhythm-search-results" className="search-results" role="listbox" aria-label="Task search results">
      <span className="section-kicker">{query ? "Matches" : "Recent tasks"}</span>
      {results.map((task, index) => <div key={task.id} id={`search-result-${task.id}`} className={`search-result ${index === safeActiveIndex ? "is-active" : ""}`} role="option" aria-selected={index === safeActiveIndex}>
        <button className={`search-check ${task.status === "completed" ? "is-complete" : ""}`} onClick={() => task.generated && task.rhythmId && task.occurrenceDate ? (task.status === "completed" ? uncompleteOccurrence({ rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate }) : completeOccurrence({ rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate })) : undefined} aria-label={`${task.status === "completed" ? "Reopen" : "Complete"} ${task.title}`} />
        <button className="search-result__open" onClick={() => onOpenTask(task)}>
          <strong>{task.title}</strong><span>{task.project} · {task.dueLabel}</span>
        </button>
      </div>)}
      {!results.length ? <p className="search-empty">Nothing found. Try a title, project, or note.</p> : null}
    </div>
    <footer className="search-dialog__footer"><span>↑↓ Move</span><span>Enter Open</span><span>Esc Close</span></footer>
  </Dialog>;
}

function TimezoneChangeNotice() {
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const current = Intl.DateTimeFormat().resolvedOptions().timeZone || "your local timezone";
    const previous = window.localStorage.getItem("rhythm.timezone");
    window.localStorage.setItem("rhythm.timezone", current);
    if (previous && previous !== current) window.setTimeout(() => setNotice(`Your timezone changed from ${previous} to ${current}. Dates stay local; review timed work before acting.`), 0);
  }, []);

  if (!notice) return null;
  return <div className="timezone-notice"><StatusMessage><span>{notice}</span><button type="button" className="notice-dismiss" aria-label="Dismiss timezone change notice" onClick={() => setNotice(null)}><X size={16} aria-hidden="true" /></button></StatusMessage></div>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navigationRef = useRef<HTMLElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const { tasks, hydrated, storageNotice, undoToast, undoLast, dismissUndoToast, recoverStorage, updateTask, deleteTask, completeOccurrence, uncompleteOccurrence, skipOccurrence, rescheduleOccurrence } = useRhythm();
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const [occurrenceTask, setOccurrenceTask] = useState<Task | null>(null);
  const completed = tasks.filter((task) => task.status === "completed").length;

  useEffect(() => {
    try {
      const preferences = JSON.parse(window.localStorage.getItem("rhythm.preferences.v1") ?? "{}");
      document.documentElement.dataset.reduceMotion = String(preferences.reducedMotion === true);
      document.documentElement.dataset.higherContrast = String(preferences.higherContrast === true);
    } catch {
      document.documentElement.dataset.reduceMotion = "false";
      document.documentElement.dataset.higherContrast = "false";
    }
    function handleKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useLayoutEffect(() => {
    if (!window.matchMedia("(max-width: 767px)").matches) return;
    navigationRef.current?.querySelector<HTMLElement>(".nav-item.is-active")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [pathname]);

  function openTask(task: Task) {
    setSearchOpen(false);
    if (task.generated) setOccurrenceTask(task);
    else setEditorTask(task);
  }

  function saveTask(draft: TaskDraft) {
    if (editorTask) updateTask(editorTask.id, draft);
    setEditorTask(null);
  }

  return <div className="app-frame">
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <aside className="sidebar" aria-label="Primary navigation">
      <Link href="/" className="brand" aria-label="Rhythm home" title="Rhythm home"><span className="brand-mark">R</span><span className="brand-name">rhythm</span></Link>
      <nav className="nav-stack" ref={navigationRef} aria-label="Main">
        {navigation.map((item) => {
          const Icon = item.icon;
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return <Link key={item.label} href={item.href} className={`nav-item ${active ? "is-active" : ""}`} aria-current={active ? "page" : undefined} title={item.label}>
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" /><span>{item.label}</span>
          </Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <button ref={searchTriggerRef} className="icon-button mobile-search" aria-label="Search Rhythm" title="Search (⌘K)" onClick={() => { setSearchOpen(true); setProfileOpen(false); }}><Search size={18} strokeWidth={1.7} aria-hidden="true" /><span>Search</span></button>
        <button className="profile-button" aria-label="Open local workspace profile" aria-expanded={profileOpen} title="Local workspace" onClick={() => { setProfileOpen((open) => !open); setSearchOpen(false); }}><span>JT</span><i aria-hidden="true" /></button>
        {profileOpen ? <div className="profile-popover" role="dialog" aria-label="Local workspace profile">
          <span className="section-kicker">Local workspace</span>
          <strong>Jazz Tinn</strong>
          <p>{tasks.length - completed ? `${tasks.length - completed} tasks open` : "You’re clear for now"}</p>
          <div><Link href="/settings" onClick={() => setProfileOpen(false)}>Settings & connections</Link><Link href="/tasks" onClick={() => setProfileOpen(false)}>Manage tasks</Link><ConfirmAction label="Restore starter data" title="Restore starter data?" description="This replaces the current local tasks and rhythms with the starter workspace. Your current workspace will be kept as an undo snapshot." confirmLabel="Restore starter data" onConfirm={() => { recoverStorage(); setProfileOpen(false); }} /></div>
        </div> : null}
      </div>
    </aside>
    <main id="main-content" className="app-content">
      <TimezoneChangeNotice />
      {hydrated ? <ViewTransition default="page-crossfade">{children}</ViewTransition> : <div className="loading-shell" role="status" aria-live="polite"><div className="loading-shell__bar" /><p>Loading your local workspace…</p></div>}
    </main>
    <div className="grain" aria-hidden="true" />
    {storageNotice ? <div className="global-notice"><StatusMessage tone="error"><span>{storageNotice}</span><ConfirmAction label="Restore starter data" title="Replace unreadable local data?" description="This creates a fresh starter workspace and replaces the unreadable local payload. The unreadable payload will not be silently removed until you confirm." confirmLabel="Replace local data" tone="danger" onConfirm={recoverStorage} /></StatusMessage></div> : null}
    {undoToast ? <Toast label={undoToast.label} onUndo={undoLast} onDismiss={dismissUndoToast} /> : null}
    <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} onOpenTask={openTask} />
    {editorTask ? <TaskEditor key={editorTask.id} task={editorTask} onClose={() => setEditorTask(null)} onSave={saveTask} onDelete={() => { deleteTask(editorTask.id); setEditorTask(null); }} /> : null}
    {occurrenceTask?.rhythmId && occurrenceTask.occurrenceDate ? <OccurrenceActionSheet task={occurrenceTask} onClose={() => setOccurrenceTask(null)} onComplete={() => { completeOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onUncomplete={() => { uncompleteOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onSkip={() => { skipOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }); setOccurrenceTask(null); }} onReschedule={(date, time) => { rescheduleOccurrence({ rhythmId: occurrenceTask.rhythmId!, occurrenceDate: occurrenceTask.occurrenceDate! }, date, time); setOccurrenceTask(null); }} /> : null}
  </div>;
}
