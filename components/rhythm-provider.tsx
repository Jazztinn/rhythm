"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAssistantActions,
  applyWorkspaceTransaction,
  createTaskFromDraft,
  createWorkspaceState,
  formatTaskDue,
  isTask,
  LEGACY_RHYTHMS_STORAGE_KEY,
  LEGACY_TASKS_STORAGE_KEY,
  migrateWorkspaceData,
  resolveTaskDate,
  seedRhythms,
  seedTasks,
  undoWorkspace,
  WORKSPACE_STORAGE_KEY,
  type AssistantAction,
  type RhythmDefinition,
  type Task,
  type TaskDraft,
  type WorkspaceMigrationStatus,
  type WorkspaceStateV3,
} from "@/lib/rhythm";

type WorkspaceRange = { start: string; end: string };
type Transaction = (current: WorkspaceStateV3) => WorkspaceStateV3;
type UndoToast = { label: string; expiresAt: number };

export type MigrationStatus = {
  status: WorkspaceMigrationStatus;
  recoverable: boolean;
  didMigrate: boolean;
};

type RhythmContextValue = {
  tasks: Task[];
  rhythms: RhythmDefinition[];
  completions: Record<string, string[]>;
  hydrated: boolean;
  migration: MigrationStatus;
  storageNotice: string | null;
  toggleTask: (id: string) => void;
  createTask: (draft: TaskDraft) => void;
  updateTask: (id: string, draft: TaskDraft) => void;
  deleteTask: (id: string) => void;
  applyActions: (actions: AssistantAction[]) => void;
  commitTransaction: (label: string, update: Transaction) => void;
  undoLast: () => void;
  undo: () => void;
  canUndo: boolean;
  getWorkItems: (range: WorkspaceRange) => Task[];
  restoreStarterData: () => void;
  toggleRhythm: (id: string) => void;
  createRhythm: (rhythm: RhythmDefinition) => void;
  deleteRhythm: (id: string) => void;
  undoToast: UndoToast | null;
  dismissUndoToast: () => void;
  recoverStorage: () => void;
};

const RhythmContext = createContext<RhythmContextValue | null>(null);

function parseStoredValue(raw: string | null): { value: unknown; invalid: boolean } {
  if (raw === null) return { value: null, invalid: false };
  try {
    return { value: JSON.parse(raw), invalid: false };
  } catch {
    return { value: { invalidStorage: true }, invalid: true };
  }
}

export function RhythmProvider({ children }: { children: React.ReactNode }) {
  const [workspace, setWorkspace] = useState<WorkspaceStateV3>(() => createWorkspaceState(seedTasks, seedRhythms));
  const [hydrated, setHydrated] = useState(false);
  const [migration, setMigration] = useState<MigrationStatus>({ status: "fresh", recoverable: false, didMigrate: false });
  const [storageNotice, setStorageNotice] = useState<string | null>(null);
  const [undoToast, setUndoToast] = useState<UndoToast | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);
  const toastTimer = useRef<number | null>(null);
  const legacyCleanupDone = useRef(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let current = { value: null as unknown, invalid: false };
      let legacyTasks = { value: null as unknown, invalid: false };
      let legacyRhythms = { value: null as unknown, invalid: false };
      try {
        current = parseStoredValue(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
        legacyTasks = parseStoredValue(window.localStorage.getItem(LEGACY_TASKS_STORAGE_KEY));
        legacyRhythms = parseStoredValue(window.localStorage.getItem(LEGACY_RHYTHMS_STORAGE_KEY));
      } catch {
        current = { value: { invalidStorage: true }, invalid: true };
      }
      const result = migrateWorkspaceData(current.value, legacyTasks.value, legacyRhythms.value);
      setWorkspace(result.state);
      setMigration({
        status: result.status,
        recoverable: result.recoverable,
        didMigrate: result.status.startsWith("migrated"),
      });
      setStorageBlocked(result.recoverable || current.invalid || legacyTasks.invalid || legacyRhythms.invalid);
      if (result.recoverable) {
        setStorageNotice("Rhythm could not read the local workspace. Your saved data is untouched; restore starter data only if you want to replace it.");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!hydrated || storageBlocked) return;
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
    if (migration.didMigrate && !legacyCleanupDone.current) {
      window.localStorage.removeItem(LEGACY_TASKS_STORAGE_KEY);
      window.localStorage.removeItem(LEGACY_RHYTHMS_STORAGE_KEY);
      legacyCleanupDone.current = true;
    }
  }, [hydrated, migration.didMigrate, storageBlocked, workspace]);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  const showUndoToast = useCallback((label: string) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    const next = { label, expiresAt: Date.now() + 5000 };
    setUndoToast(next);
    toastTimer.current = window.setTimeout(() => setUndoToast(null), 5000);
  }, []);

  const commitTransaction = useCallback((label: string, update: Transaction) => {
    setWorkspace((current) => {
      const next = applyWorkspaceTransaction(current, label, update);
      if (next !== current) showUndoToast(label);
      return next;
    });
  }, [showUndoToast]);

  const toggleTask = useCallback((id: string) => {
    commitTransaction("Updated task completion", (current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? { ...task, status: task.status === "completed" ? "pending" : "completed" } : task),
    }));
  }, [commitTransaction]);

  const createTask = useCallback((draft: TaskDraft) => {
    commitTransaction("Added task", (current) => ({ ...current, tasks: [createTaskFromDraft(draft), ...current.tasks] }));
  }, [commitTransaction]);

  const updateTask = useCallback((id: string, draft: TaskDraft) => {
    commitTransaction("Edited task", (current) => ({
      ...current,
      tasks: current.tasks.map((task) => task.id === id ? {
        ...task,
        title: draft.title.trim(),
        project: draft.project.trim() || "Personal",
        dueLabel: formatTaskDue(draft.dueDate, draft.dueTime),
        dueDate: draft.dueDate,
        dueTime: draft.dueTime,
        estimateMinutes: Math.min(Math.max(draft.estimateMinutes, 5), 480),
        priority: draft.priority,
        later: draft.later,
        note: draft.note?.trim() || undefined,
      } : task),
    }));
  }, [commitTransaction]);

  const deleteTask = useCallback((id: string) => {
    commitTransaction("Deleted task", (current) => ({ ...current, tasks: current.tasks.filter((task) => task.id !== id) }));
  }, [commitTransaction]);

  const applyActions = useCallback((actions: AssistantAction[]) => {
    if (!actions.length) return;
    commitTransaction("Applied assistant task changes", (current) => ({ ...current, tasks: applyAssistantActions(current.tasks, actions) }));
  }, [commitTransaction]);

  const undoLast = useCallback(() => {
    setWorkspace((current) => {
      const next = undoWorkspace(current);
      if (next !== current) setUndoToast(null);
      return next;
    });
  }, []);

  const restoreStarterData = useCallback(() => {
    setStorageBlocked(false);
    setStorageNotice(null);
    setMigration({ status: "fresh", recoverable: false, didMigrate: false });
    setWorkspace((current) => {
      const next = applyWorkspaceTransaction(current, "Restored starter data", (state) => ({
        ...createWorkspaceState(),
        settings: { ...state.settings, starterDataAvailable: true },
      }));
      showUndoToast("Restored starter data");
      return next;
    });
  }, [showUndoToast]);

  const recoverStorage = useCallback(() => {
    restoreStarterData();
  }, [restoreStarterData]);

  const getWorkItems = useCallback((range: WorkspaceRange) => workspace.tasks.filter((task) => {
    const date = resolveTaskDate(task);
    return !date || (date >= range.start && date <= range.end);
  }), [workspace.tasks]);

  const toggleRhythm = useCallback((id: string) => {
    const date = new Date().toISOString().slice(0, 10);
    commitTransaction("Updated rhythm completion", (current) => {
      const done = current.completions[date] ?? [];
      return {
        ...current,
        completions: { ...current.completions, [date]: done.includes(id) ? done.filter((item) => item !== id) : [...done, id] },
      };
    });
  }, [commitTransaction]);

  const createRhythm = useCallback((rhythm: RhythmDefinition) => {
    commitTransaction("Added rhythm", (current) => ({ ...current, rhythms: [...current.rhythms, rhythm] }));
  }, [commitTransaction]);

  const deleteRhythm = useCallback((id: string) => {
    commitTransaction("Deleted rhythm", (current) => ({
      ...current,
      rhythms: current.rhythms.filter((rhythm) => rhythm.id !== id),
      completions: Object.fromEntries(Object.entries(current.completions).map(([date, ids]) => [date, ids.filter((item) => item !== id)])),
    }));
  }, [commitTransaction]);

  const dismissUndoToast = useCallback(() => setUndoToast(null), []);
  const canUndo = workspace.history.length > 0;
  const value = useMemo<RhythmContextValue>(() => ({
    tasks: workspace.tasks,
    rhythms: workspace.rhythms,
    completions: workspace.completions,
    hydrated,
    migration,
    storageNotice,
    toggleTask,
    createTask,
    updateTask,
    deleteTask,
    applyActions,
    commitTransaction,
    undoLast,
    undo: undoLast,
    canUndo,
    getWorkItems,
    restoreStarterData,
    toggleRhythm,
    createRhythm,
    deleteRhythm,
    undoToast,
    dismissUndoToast,
    recoverStorage,
  }), [applyActions, canUndo, commitTransaction, createRhythm, createTask, deleteTask, deleteRhythm, dismissUndoToast, getWorkItems, hydrated, migration, recoverStorage, restoreStarterData, storageNotice, toggleRhythm, toggleTask, undoLast, undoToast, updateTask, workspace.completions, workspace.rhythms, workspace.tasks]);

  return <RhythmContext.Provider value={value}>{children}</RhythmContext.Provider>;
}

export function useRhythm() {
  const context = useContext(RhythmContext);
  if (!context) throw new Error("useRhythm must be used inside RhythmProvider");
  return context;
}

export function isWorkspaceTask(value: unknown): value is Task {
  return isTask(value);
}
