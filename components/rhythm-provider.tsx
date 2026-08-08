"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  applyAssistantActions,
  seedTasks,
  type AssistantAction,
  type Task,
} from "@/lib/rhythm";

const STORAGE_KEY = "rhythm.tasks.v1";

type RhythmContextValue = {
  tasks: Task[];
  hydrated: boolean;
  toggleTask: (id: string) => void;
  applyActions: (actions: AssistantAction[]) => void;
  undo: () => void;
  canUndo: boolean;
  reset: () => void;
};

const RhythmContext = createContext<RhythmContextValue | null>(null);

function isTaskArray(value: unknown): value is Task[] {
  return (
    Array.isArray(value) &&
    value.every(
      (task) =>
        typeof task === "object" &&
        task !== null &&
        typeof (task as Task).id === "string" &&
        typeof (task as Task).title === "string",
    )
  );
}

export function RhythmProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [history, setHistory] = useState<Task[][]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed: unknown = JSON.parse(saved);
          if (isTaskArray(parsed)) setTasks(parsed);
        }
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [hydrated, tasks]);

  const commit = useCallback((next: Task[] | ((current: Task[]) => Task[])) => {
    setTasks((current) => {
      const resolved = typeof next === "function" ? next(current) : next;
      if (resolved === current) return current;
      setHistory((previous) => [...previous.slice(-7), current]);
      return resolved;
    });
  }, []);

  const toggleTask = useCallback(
    (id: string) => {
      commit((current) =>
        current.map((task) =>
          task.id === id
            ? {
                ...task,
                status: task.status === "completed" ? "pending" : "completed",
              }
            : task,
        ),
      );
    },
    [commit],
  );

  const applyActions = useCallback(
    (actions: AssistantAction[]) => {
      if (!actions.length) return;
      commit((current) => applyAssistantActions(current, actions));
    },
    [commit],
  );

  const undo = useCallback(() => {
    setHistory((previous) => {
      const latest = previous.at(-1);
      if (!latest) return previous;
      setTasks(latest);
      return previous.slice(0, -1);
    });
  }, []);

  const reset = useCallback(() => {
    commit(seedTasks.map((task) => ({ ...task })));
  }, [commit]);

  const value = useMemo(
    () => ({
      tasks,
      hydrated,
      toggleTask,
      applyActions,
      undo,
      canUndo: history.length > 0,
      reset,
    }),
    [tasks, hydrated, toggleTask, applyActions, undo, history.length, reset],
  );

  return <RhythmContext.Provider value={value}>{children}</RhythmContext.Provider>;
}

export function useRhythm() {
  const context = useContext(RhythmContext);
  if (!context) throw new Error("useRhythm must be used inside RhythmProvider");
  return context;
}
