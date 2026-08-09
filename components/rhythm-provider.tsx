"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  applyAssistantActions,
  applyWorkspaceTransaction,
  createTaskFromDraft,
  createWorkspaceState,
  dateRangeFrom,
  formatTaskDue,
  generateOccurrences,
  getNextRhythmOccurrence,
  isTask,
  LEGACY_RHYTHMS_STORAGE_KEY,
  LEGACY_TASKS_STORAGE_KEY,
  migrateWorkspaceData,
  normalizeRhythmDefinition,
  resolveTaskDate,
  seedRhythms,
  seedTasks,
  splitRhythmDefinition,
  undoWorkspace,
  WORKSPACE_STORAGE_KEY,
  type AssistantAction,
  type RhythmDefinition,
  type RhythmException,
  type RhythmCompletion,
  type RhythmOccurrenceChanges,
  type Task,
  type TaskDraft,
  type WorkspaceMigrationStatus,
  type WorkspaceStateV3,
} from "@/lib/rhythm";

type WorkspaceRange = { start: string; end: string };
export type OccurrenceRef = { rhythmId: string; occurrenceDate: string };
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
  rhythmExceptions: RhythmException[];
  rhythmCompletions: RhythmCompletion[];
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
  updateRhythm: (id: string, rhythm: RhythmDefinition) => void;
  updateRhythmFuture: (id: string, fromDate: string, rhythm: RhythmDefinition) => void;
  pauseRhythm: (id: string) => void;
  resumeRhythm: (id: string) => void;
  archiveRhythm: (id: string) => void;
  deleteRhythm: (id: string) => void;
  completeOccurrence: (occurrence: OccurrenceRef) => void;
  uncompleteOccurrence: (occurrence: OccurrenceRef) => void;
  skipOccurrence: (occurrence: OccurrenceRef) => void;
  rescheduleOccurrence: (occurrence: OccurrenceRef, replacementDate: string, replacementTime?: string) => void;
  editOccurrence: (occurrence: OccurrenceRef, changes: RhythmOccurrenceChanges) => void;
  skipNextOccurrence: (rhythmId: string, fromDate?: string) => void;
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

  const getWorkItems = useCallback((range: WorkspaceRange) => {
    const manualTasks = workspace.tasks.filter((task) => !task.generated && (() => {
      const date = resolveTaskDate(task);
      return !date || (date >= range.start && date <= range.end);
    })());
    return [...manualTasks, ...generateOccurrences(workspace.rhythms, workspace.rhythmExceptions, workspace.rhythmCompletions, range.start, range.end)];
  }, [workspace.rhythmCompletions, workspace.rhythmExceptions, workspace.rhythms, workspace.tasks]);

  const toggleRhythm = useCallback((id: string) => {
    const rhythm = workspace.rhythms.find((item) => item.id === id);
    const occurrenceDate = rhythm ? getNextRhythmOccurrence(rhythm, dateRangeFrom(new Date(), 0, 0).start) : null;
    if (!occurrenceDate) return;
    const completed = workspace.rhythmCompletions.some((item) => item.rhythmId === id && item.occurrenceDate === occurrenceDate);
    commitTransaction(completed ? "Reopened rhythm occurrence" : "Completed rhythm occurrence", (current) => {
      if (completed) return { ...current, rhythmCompletions: current.rhythmCompletions.filter((item) => !(item.rhythmId === id && item.occurrenceDate === occurrenceDate)), completions: { ...current.completions, [occurrenceDate]: (current.completions[occurrenceDate] ?? []).filter((item) => item !== id) } };
      return { ...current, rhythmCompletions: [...current.rhythmCompletions, { rhythmId: id, occurrenceDate, completedAt: new Date().toISOString() }], completions: { ...current.completions, [occurrenceDate]: [...new Set([...(current.completions[occurrenceDate] ?? []), id])] } };
    });
  }, [commitTransaction, workspace.rhythmCompletions, workspace.rhythms]);

  const createRhythm = useCallback((rhythm: RhythmDefinition) => {
    commitTransaction("Added rhythm", (current) => ({ ...current, rhythms: [...current.rhythms, normalizeRhythmDefinition(rhythm)] }));
  }, [commitTransaction]);

  const updateRhythm = useCallback((id: string, rhythm: RhythmDefinition) => {
    commitTransaction("Edited rhythm", (current) => ({ ...current, rhythms: current.rhythms.map((item) => item.id === id ? normalizeRhythmDefinition(rhythm) : item) }));
  }, [commitTransaction]);

  const updateRhythmFuture = useCallback((id: string, fromDate: string, rhythm: RhythmDefinition) => {
    commitTransaction("Edited this and future rhythm occurrences", (current) => {
      const existing = current.rhythms.find((item) => item.id === id);
      if (!existing) return current;
      if (fromDate <= existing.startsOn) {
        return { ...current, rhythms: current.rhythms.map((item) => item.id === id ? normalizeRhythmDefinition({ ...rhythm, id, startsOn: existing.startsOn }) : item) };
      }
      const split = splitRhythmDefinition(existing, fromDate, rhythm);
      if (!split) return current;
      return {
        ...current,
        rhythms: [...current.rhythms.filter((item) => item.id !== id), split.past, split.future],
        rhythmExceptions: current.rhythmExceptions.map((item) => item.rhythmId === id && item.occurrenceDate >= fromDate ? { ...item, rhythmId: split.future.id } : item),
        rhythmCompletions: current.rhythmCompletions.map((item) => item.rhythmId === id && item.occurrenceDate >= fromDate ? { ...item, rhythmId: split.future.id } : item),
        completions: Object.fromEntries(Object.entries(current.completions).map(([date, ids]) => [date, date >= fromDate ? ids.map((item) => item === id ? split.future.id : item) : ids])),
      };
    });
  }, [commitTransaction]);

  const pauseRhythm = useCallback((id: string) => {
    commitTransaction("Paused rhythm", (current) => ({ ...current, rhythms: current.rhythms.map((rhythm) => rhythm.id === id ? { ...rhythm, paused: true } : rhythm) }));
  }, [commitTransaction]);

  const resumeRhythm = useCallback((id: string) => {
    commitTransaction("Resumed rhythm", (current) => ({ ...current, rhythms: current.rhythms.map((rhythm) => rhythm.id === id ? { ...rhythm, paused: false, archived: false } : rhythm) }));
  }, [commitTransaction]);

  const archiveRhythm = useCallback((id: string) => {
    commitTransaction("Archived rhythm", (current) => ({ ...current, rhythms: current.rhythms.map((rhythm) => rhythm.id === id ? { ...rhythm, archived: true, paused: true } : rhythm) }));
  }, [commitTransaction]);

  const deleteRhythm = useCallback((id: string) => {
    commitTransaction("Deleted rhythm", (current) => ({
      ...current,
      rhythms: current.rhythms.filter((rhythm) => rhythm.id !== id),
      completions: Object.fromEntries(Object.entries(current.completions).map(([date, ids]) => [date, ids.filter((item) => item !== id)])),
      rhythmCompletions: current.rhythmCompletions.filter((item) => item.rhythmId !== id),
      rhythmExceptions: current.rhythmExceptions.filter((item) => item.rhythmId !== id),
    }));
  }, [commitTransaction]);

  const updateOccurrence = useCallback((label: string, occurrence: OccurrenceRef, update: (current: WorkspaceStateV3) => WorkspaceStateV3) => {
    commitTransaction(label, (current) => update(current));
  }, [commitTransaction]);

  const completeOccurrence = useCallback((occurrence: OccurrenceRef) => {
    updateOccurrence("Completed rhythm occurrence", occurrence, (current) => {
      if (current.rhythmCompletions.some((item) => item.rhythmId === occurrence.rhythmId && item.occurrenceDate === occurrence.occurrenceDate)) return current;
      const nextCompletions = [...current.rhythmCompletions, { ...occurrence, completedAt: new Date().toISOString() }];
      const dateCompletions = current.completions[occurrence.occurrenceDate] ?? [];
      return { ...current, rhythmCompletions: nextCompletions, completions: { ...current.completions, [occurrence.occurrenceDate]: dateCompletions.includes(occurrence.rhythmId) ? dateCompletions : [...dateCompletions, occurrence.rhythmId] } };
    });
  }, [updateOccurrence]);

  const uncompleteOccurrence = useCallback((occurrence: OccurrenceRef) => {
    updateOccurrence("Reopened rhythm occurrence", occurrence, (current) => ({
      ...current,
      rhythmCompletions: current.rhythmCompletions.filter((item) => !(item.rhythmId === occurrence.rhythmId && item.occurrenceDate === occurrence.occurrenceDate)),
      completions: { ...current.completions, [occurrence.occurrenceDate]: (current.completions[occurrence.occurrenceDate] ?? []).filter((id) => id !== occurrence.rhythmId) },
    }));
  }, [updateOccurrence]);

  const skipOccurrence = useCallback((occurrence: OccurrenceRef) => {
    updateOccurrence("Skipped rhythm occurrence", occurrence, (current) => ({
      ...current,
      rhythmExceptions: [...current.rhythmExceptions.filter((item) => !(item.rhythmId === occurrence.rhythmId && item.occurrenceDate === occurrence.occurrenceDate)), { ...occurrence, kind: "skip" }],
    }));
  }, [updateOccurrence]);

  const rescheduleOccurrence = useCallback((occurrence: OccurrenceRef, replacementDate: string, replacementTime?: string) => {
    updateOccurrence("Rescheduled rhythm occurrence", occurrence, (current) => ({
      ...current,
      rhythmExceptions: [...current.rhythmExceptions.filter((item) => !(item.rhythmId === occurrence.rhythmId && item.occurrenceDate === occurrence.occurrenceDate)), { ...occurrence, kind: "reschedule", replacementDate, ...(replacementTime ? { replacementTime } : {}), changes: current.rhythmExceptions.find((item) => item.rhythmId === occurrence.rhythmId && item.occurrenceDate === occurrence.occurrenceDate)?.changes }],
    }));
  }, [updateOccurrence]);

  const editOccurrence = useCallback((occurrence: OccurrenceRef, changes: RhythmOccurrenceChanges) => {
    updateOccurrence("Edited rhythm occurrence", occurrence, (current) => {
      const existing = current.rhythmExceptions.find((item) => item.rhythmId === occurrence.rhythmId && item.occurrenceDate === occurrence.occurrenceDate);
      const next: RhythmException = existing
        ? { ...existing, changes }
        : { ...occurrence, kind: "modify", changes };
      return { ...current, rhythmExceptions: [...current.rhythmExceptions.filter((item) => !(item.rhythmId === occurrence.rhythmId && item.occurrenceDate === occurrence.occurrenceDate)), next] };
    });
  }, [updateOccurrence]);

  const skipNextOccurrence = useCallback((rhythmId: string, fromDate = dateRangeFrom(new Date(), 0, 0).start) => {
    const rhythm = workspace.rhythms.find((item) => item.id === rhythmId);
    const occurrenceDate = rhythm ? getNextRhythmOccurrence(rhythm, fromDate) : null;
    if (occurrenceDate) skipOccurrence({ rhythmId, occurrenceDate });
  }, [skipOccurrence, workspace.rhythms]);

  const dismissUndoToast = useCallback(() => setUndoToast(null), []);
  const canUndo = workspace.history.length > 0;
  const value = useMemo<RhythmContextValue>(() => ({
    tasks: workspace.tasks,
    rhythms: workspace.rhythms,
    completions: workspace.completions,
    rhythmExceptions: workspace.rhythmExceptions,
    rhythmCompletions: workspace.rhythmCompletions,
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
    updateRhythm,
    updateRhythmFuture,
    pauseRhythm,
    resumeRhythm,
    archiveRhythm,
    deleteRhythm,
    completeOccurrence,
    uncompleteOccurrence,
    skipOccurrence,
    rescheduleOccurrence,
    editOccurrence,
    skipNextOccurrence,
    undoToast,
    dismissUndoToast,
    recoverStorage,
  }), [applyActions, archiveRhythm, canUndo, commitTransaction, completeOccurrence, createRhythm, createTask, deleteTask, deleteRhythm, dismissUndoToast, editOccurrence, getWorkItems, hydrated, migration, pauseRhythm, recoverStorage, restoreStarterData, rescheduleOccurrence, resumeRhythm, skipNextOccurrence, skipOccurrence, storageNotice, toggleRhythm, toggleTask, undoLast, undoToast, uncompleteOccurrence, updateRhythm, updateRhythmFuture, updateTask, workspace.completions, workspace.rhythmCompletions, workspace.rhythmExceptions, workspace.rhythms, workspace.tasks]);

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
