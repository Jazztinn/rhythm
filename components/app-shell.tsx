"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  CheckSquare2,
  MessageCircleMore,
  Orbit,
  Search,
  Sparkles,
} from "lucide-react";

const navigation = [
  { label: "Today", href: "/", icon: CheckSquare2, enabled: true },
  { label: "Chat", href: "/chat", icon: MessageCircleMore, enabled: true },
  { label: "Tasks", href: "/tasks", icon: Sparkles, enabled: false },
  { label: "Calendar", href: "/calendar", icon: CalendarDays, enabled: false },
  { label: "Rhythms", href: "/rhythms", icon: Orbit, enabled: false },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="app-frame">
      <aside className="sidebar" aria-label="Primary navigation">
        <Link href="/" className="brand" aria-label="Rhythm home">
          <span className="brand-mark">R</span>
          <span className="brand-name">rhythm</span>
        </Link>

        <nav className="nav-stack">
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
              >
                <Icon size={19} strokeWidth={1.7} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <button className="icon-button" aria-label="Search Rhythm">
            <Search size={18} strokeWidth={1.7} />
          </button>
          <button className="profile-button" aria-label="Open profile">
            <span>JT</span>
            <i />
          </button>
        </div>
      </aside>
      <main className="app-content">{children}</main>
      <div className="grain" aria-hidden="true" />
    </div>
  );
}
