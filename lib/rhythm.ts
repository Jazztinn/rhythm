export type TaskStatus = "pending" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type TaskSource = "task" | "calendar" | "slack" | "rhythm";

export type Task = {
  id: string;
  title: string;
  project: string;
  dueLabel: string;
  estimateMinutes: number;
  status: TaskStatus;
  priority: TaskPriority;
  source: TaskSource;
  later: boolean;
  dueDate?: string;
  dueTime?: string;
  note?: string;
  rhythmId?: string;
  occurrenceDate?: string;
  generated?: boolean;
  calendarReference?: string;
};

export type RhythmDefinition = {
  id: string;
  title: string;
  note: string;
  time: string;
  icon: "sun" | "waves" | "moon" | "orbit";
  tone: "lime" | "violet" | "peach";
};

export type WorkspaceSettings = {
  starterDataAvailable: boolean;
  displayName: string;
};

export type WorkspaceSnapshot = {
  label: string;
  createdAt: string;
  tasks: Task[];
  rhythms: RhythmDefinition[];
  exceptions: Record<string, string[]>;
  completions: Record<string, string[]>;
  settings: WorkspaceSettings;
};

export type WorkspaceStateV3 = {
  version: 3;
  tasks: Task[];
  rhythms: RhythmDefinition[];
  exceptions: Record<string, string[]>;
  completions: Record<string, string[]>;
  settings: WorkspaceSettings;
  history: WorkspaceSnapshot[];
};

export type WorkspaceMigrationStatus =
  | "fresh"
  | "v3"
  | "migrated-tasks"
  | "migrated-rhythms"
  | "migrated-both"
  | "corrupt";

export type CalendarEvidence = {
  status: "disconnected" | "partial" | "connected";
  scheduledMinutes?: number;
  availableMinutes?: number;
};

export type WorkloadSummary = {
  pendingCount: number;
  plannedMinutes: number;
  datedCount: number;
  evidence: "tasks-only" | "tasks-and-calendar" | "partial-calendar";
  statement: string;
};

export type TaskDraft = {
  title: string;
  project: string;
  dueDate: string;
  dueTime: string;
  estimateMinutes: number;
  priority: TaskPriority;
  later: boolean;
  note?: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: AssistantAction[];
};

export type CreateTaskAction = {
  type: "create_task";
  taskId: null;
  title: string;
  project: string;
  dueLabel: string;
  estimateMinutes: number;
};

export type CompleteTaskAction = {
  type: "complete_task";
  taskId: string;
  title: null;
  project: null;
  dueLabel: null;
  estimateMinutes: null;
};

export type RescheduleTaskAction = {
  type: "reschedule_task";
  taskId: string;
  title: null;
  project: null;
  dueLabel: string;
  estimateMinutes: null;
};

export type AssistantAction =
  | CreateTaskAction
  | CompleteTaskAction
  | RescheduleTaskAction;

export type ChatReply = {
  message: string;
  suggestions: string[];
  actions: AssistantAction[];
};

export type ApplyAssistantActionsOptions = {
  createTaskId?: () => string;
};

export function clampEstimateMinutes(value: number) {
  return Math.min(Math.max(value, 5), 480);
}

export function createLocalTaskId() {
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, amount: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function formatTaskDue(dateKey: string, time: string, now = new Date()) {
  const today = toDateKey(now);
  const tomorrow = toDateKey(addDays(now, 1));
  const label = dateKey === today
    ? "Today"
    : dateKey === tomorrow
      ? "Tomorrow"
      : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
          new Date(`${dateKey}T12:00:00`),
        );
  if (!time) return label;
  const timeLabel = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(
    new Date(`${dateKey}T${time}:00`),
  );
  return `${label} · ${timeLabel}`;
}

export function resolveTaskDate(task: Task, now = new Date()) {
  if (task.dueDate) return task.dueDate;
  const label = task.dueLabel.toLowerCase();
  if (label.includes("tomorrow")) return toDateKey(addDays(now, 1));
  if (label.includes("sunday")) {
    const distance = (7 - now.getDay()) % 7 || 7;
    return toDateKey(addDays(now, distance));
  }
  if (label.includes("weekend")) {
    const distance = (6 - now.getDay() + 7) % 7;
    return toDateKey(addDays(now, distance));
  }
  if (label.includes("today") || label.includes("tonight") || /\d{1,2}:\d{2}/.test(label)) {
    return toDateKey(now);
  }
  return null;
}

export function createTaskFromDraft(draft: TaskDraft, id = createLocalTaskId()): Task {
  const dueDate = draft.dueDate || toDateKey(new Date());
  return {
    id,
    title: draft.title.trim(),
    project: draft.project.trim() || "Personal",
    dueLabel: formatTaskDue(dueDate, draft.dueTime),
    dueDate,
    dueTime: draft.dueTime,
    estimateMinutes: clampEstimateMinutes(draft.estimateMinutes),
    status: "pending",
    priority: draft.priority,
    source: "task",
    later: draft.later,
    note: draft.note?.trim() || undefined,
  };
}

export const seedTasks: Task[] = [
  {
    id: "techforgood-mockups",
    title: "Submit TechForGood mockups",
    project: "TechForGood",
    dueLabel: "10:00 PM",
    dueTime: "22:00",
    estimateMinutes: 35,
    status: "pending",
    priority: "high",
    source: "task",
    later: false,
    note: "Final export and submission notes are ready.",
  },
  {
    id: "monday-meeting",
    title: "Prepare for Monday meeting",
    project: "NEXT",
    dueLabel: "Tomorrow",
    dueTime: "09:00",
    estimateMinutes: 25,
    status: "pending",
    priority: "medium",
    source: "calendar",
    later: false,
    note: "AI recommends starting tonight.",
  },
  {
    id: "reply-casey",
    title: "Reply to Casey",
    project: "NEXT · Slack",
    dueLabel: "Tonight",
    dueTime: "18:30",
    estimateMinutes: 8,
    status: "pending",
    priority: "medium",
    source: "slack",
    later: false,
  },
  {
    id: "review-abstract",
    title: "Review competition abstract",
    project: "TechForGood",
    dueLabel: "Done at 4:20 PM",
    dueTime: "16:20",
    estimateMinutes: 30,
    status: "completed",
    priority: "medium",
    source: "task",
    later: false,
  },
  {
    id: "cs202-notes",
    title: "Organize CS 202 notes",
    project: "University",
    dueLabel: "Done at 2:10 PM",
    dueTime: "14:10",
    estimateMinutes: 20,
    status: "completed",
    priority: "low",
    source: "task",
    later: false,
  },
  {
    id: "weekly-review",
    title: "Weekly review",
    project: "Personal rhythm",
    dueLabel: "Sunday",
    estimateMinutes: 25,
    status: "pending",
    priority: "low",
    source: "rhythm",
    later: true,
  },
  {
    id: "leetcode-session",
    title: "LeetCode practice",
    project: "Growth",
    dueLabel: "This weekend",
    estimateMinutes: 45,
    status: "pending",
    priority: "low",
    source: "rhythm",
    later: true,
  },
];

export const seedRhythms: RhythmDefinition[] = [
  { id: "morning", title: "Start softly", note: "Water, sunlight, no inbox", time: "08:00", icon: "sun", tone: "lime" },
  { id: "focus", title: "Protect one deep block", note: "One important thing, fully present", time: "10:00", icon: "waves", tone: "violet" },
  { id: "shutdown", title: "Close the loops", note: "Review, reset, step away", time: "20:30", icon: "moon", tone: "peach" },
];

export const WORKSPACE_STORAGE_KEY = "rhythm.workspace.v3";
export const LEGACY_TASKS_STORAGE_KEY = "rhythm.tasks.v1";
export const LEGACY_RHYTHMS_STORAGE_KEY = "rhythm.routines.v2";

function cloneTasks(tasks: Task[]) {
  return tasks.map((task) => ({ ...task }));
}

function cloneRhythms(rhythms: RhythmDefinition[]) {
  return rhythms.map((rhythm) => ({ ...rhythm }));
}

function cloneRecord(record: Record<string, string[]>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, [...value]]));
}

function defaultWorkspaceSettings(): WorkspaceSettings {
  return { starterDataAvailable: true, displayName: "Jazz Tinn" };
}

export function createWorkspaceState(
  tasks: Task[] = cloneTasks(seedTasks),
  rhythms: RhythmDefinition[] = cloneRhythms(seedRhythms),
): WorkspaceStateV3 {
  return {
    version: 3,
    tasks: cloneTasks(tasks),
    rhythms: cloneRhythms(rhythms),
    exceptions: {},
    completions: {},
    settings: defaultWorkspaceSettings(),
    history: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isTask(value: unknown): value is Task {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string") return false;
  return typeof value.project === "string" && typeof value.dueLabel === "string" &&
    (value.status === "pending" || value.status === "completed") &&
    (value.priority === "low" || value.priority === "medium" || value.priority === "high") &&
    typeof value.estimateMinutes === "number";
}

export function isRhythmDefinition(value: unknown): value is RhythmDefinition {
  if (!isRecord(value)) return false;
  return typeof value.id === "string" && typeof value.title === "string" &&
    typeof value.note === "string" && typeof value.time === "string" &&
    ["sun", "waves", "moon", "orbit"].includes(value.icon as string) &&
    ["lime", "violet", "peach"].includes(value.tone as string);
}

function isStringRecord(value: unknown): value is Record<string, string[]> {
  return isRecord(value) && Object.values(value).every((entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string"));
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  return isRecord(value) && typeof value.label === "string" && typeof value.createdAt === "string" &&
    Array.isArray(value.tasks) && value.tasks.every(isTask) &&
    Array.isArray(value.rhythms) && value.rhythms.every(isRhythmDefinition) &&
    isStringRecord(value.exceptions) && isStringRecord(value.completions) &&
    isRecord(value.settings) && typeof value.settings.starterDataAvailable === "boolean" &&
    typeof value.settings.displayName === "string";
}

export function isWorkspaceStateV3(value: unknown): value is WorkspaceStateV3 {
  return isRecord(value) && value.version === 3 && Array.isArray(value.tasks) && value.tasks.every(isTask) &&
    Array.isArray(value.rhythms) && value.rhythms.every(isRhythmDefinition) &&
    isStringRecord(value.exceptions) && isStringRecord(value.completions) &&
    isRecord(value.settings) && typeof value.settings.starterDataAvailable === "boolean" &&
    typeof value.settings.displayName === "string" && Array.isArray(value.history) &&
    value.history.length <= 10 && value.history.every(isWorkspaceSnapshot);
}

export function migrateWorkspaceData(
  v3Value: unknown,
  legacyTasksValue: unknown,
  legacyRhythmsValue: unknown,
): { state: WorkspaceStateV3; status: WorkspaceMigrationStatus; recoverable: boolean } {
  if (v3Value !== null && v3Value !== undefined) {
    if (isWorkspaceStateV3(v3Value)) {
      return { state: v3Value, status: "v3", recoverable: false };
    }
    return { state: createWorkspaceState(), status: "corrupt", recoverable: true };
  }

  const hasLegacyTasks = legacyTasksValue !== null && legacyTasksValue !== undefined;
  const hasLegacyRhythms = legacyRhythmsValue !== null && legacyRhythmsValue !== undefined;
  const legacyTasks = Array.isArray(legacyTasksValue) ? legacyTasksValue.filter(isTask) : [];
  const legacyRhythms = isRecord(legacyRhythmsValue) && Array.isArray(legacyRhythmsValue.routines)
    ? legacyRhythmsValue.routines.filter(isRhythmDefinition)
    : [];

  if ((hasLegacyTasks && !Array.isArray(legacyTasksValue)) || (hasLegacyRhythms && !isRecord(legacyRhythmsValue))) {
    return { state: createWorkspaceState(), status: "corrupt", recoverable: true };
  }

  const state = createWorkspaceState(
    legacyTasks.length ? legacyTasks : seedTasks,
    legacyRhythms.length ? legacyRhythms : seedRhythms,
  );
  if (isRecord(legacyRhythmsValue) && legacyRhythmsValue.date === toDateKey(new Date()) && Array.isArray(legacyRhythmsValue.done)) {
    state.completions[toDateKey(new Date())] = legacyRhythmsValue.done.filter((id): id is string => typeof id === "string");
  }

  const status: WorkspaceMigrationStatus = hasLegacyTasks && hasLegacyRhythms
    ? "migrated-both"
    : hasLegacyTasks
      ? "migrated-tasks"
      : hasLegacyRhythms
        ? "migrated-rhythms"
        : "fresh";
  return { state, status, recoverable: false };
}

function snapshotFor(state: WorkspaceStateV3, label: string, createdAt = new Date().toISOString()): WorkspaceSnapshot {
  return {
    label,
    createdAt,
    tasks: cloneTasks(state.tasks),
    rhythms: cloneRhythms(state.rhythms),
    exceptions: cloneRecord(state.exceptions),
    completions: cloneRecord(state.completions),
    settings: { ...state.settings },
  };
}

export function applyWorkspaceTransaction(
  state: WorkspaceStateV3,
  label: string,
  update: (current: WorkspaceStateV3) => WorkspaceStateV3,
  createdAt = new Date().toISOString(),
): WorkspaceStateV3 {
  const next = update(state);
  if (next === state) return state;
  return {
    ...next,
    version: 3,
    history: [...state.history, snapshotFor(state, label, createdAt)].slice(-10),
  };
}

export function undoWorkspace(state: WorkspaceStateV3): WorkspaceStateV3 {
  const snapshot = state.history.at(-1);
  if (!snapshot) return state;
  return {
    version: 3,
    tasks: cloneTasks(snapshot.tasks),
    rhythms: cloneRhythms(snapshot.rhythms),
    exceptions: cloneRecord(snapshot.exceptions),
    completions: cloneRecord(snapshot.completions),
    settings: { ...snapshot.settings },
    history: state.history.slice(0, -1),
  };
}

export function buildTaskSearchIndex(tasks: Task[]) {
  return tasks.map((task) => ({
    task,
    text: `${task.title} ${task.project} ${task.note ?? ""}`.toLocaleLowerCase(),
  }));
}

export function searchTasks(tasks: Task[], query: string, limit = 8) {
  const clean = query.trim().toLocaleLowerCase();
  return buildTaskSearchIndex(tasks)
    .filter(({ text }) => !clean || text.includes(clean))
    .slice(0, limit)
    .map(({ task }) => task);
}

export function selectRecommendedTask(tasks: Task[], now = new Date()) {
  const nowKey = toDateKey(now);
  return tasks
    .filter((task) => task.status === "pending" && !task.later)
    .sort((a, b) => {
      const dateRank = (task: Task) => {
        const date = resolveTaskDate(task, now);
        if (!date || date < nowKey) return 0;
        if (date === nowKey) return 1;
        return 2;
      };
      const timeRank = (task: Task) => task.dueTime ? Number(task.dueTime.replace(":", "")) : 9999;
      const priorityRank = { high: 0, medium: 1, low: 2 };
      return dateRank(a) - dateRank(b) || timeRank(a) - timeRank(b) || priorityRank[a.priority] - priorityRank[b.priority] || a.estimateMinutes - b.estimateMinutes;
    })[0];
}

export function summarizeWorkload(tasks: Task[], calendar?: CalendarEvidence): WorkloadSummary {
  const pending = tasks.filter((task) => task.status === "pending");
  const plannedMinutes = pending.reduce((total, task) => total + clampEstimateMinutes(task.estimateMinutes), 0);
  const datedCount = pending.filter((task) => Boolean(task.dueDate || resolveTaskDate(task))).length;
  if (!calendar || calendar.status === "disconnected") {
    return {
      pendingCount: pending.length,
      plannedMinutes,
      datedCount,
      evidence: "tasks-only",
      statement: `Based on your tasks only: ${pending.length} open task${pending.length === 1 ? "" : "s"}, ${plannedMinutes} minutes planned.`,
    };
  }
  if (calendar.status === "partial") {
    return {
      pendingCount: pending.length,
      plannedMinutes,
      datedCount,
      evidence: "partial-calendar",
      statement: `Based on ${pending.length} open task${pending.length === 1 ? "" : "s"} and partial calendar evidence: ${plannedMinutes} task minutes planned.`,
    };
  }
  const scheduledMinutes = calendar.scheduledMinutes ?? 0;
  return {
    pendingCount: pending.length,
    plannedMinutes,
    datedCount,
    evidence: "tasks-and-calendar",
    statement: `Based on tasks and calendar evidence: ${plannedMinutes} task minutes and ${scheduledMinutes} scheduled minutes.`,
  };
}

export function applyAssistantActions(
  tasks: Task[],
  actions: AssistantAction[],
  options: ApplyAssistantActionsOptions = {},
): Task[] {
  const createTaskId = options.createTaskId ?? createLocalTaskId;
  return actions.reduce((current, action) => {
    if (action.type === "create_task") {
      const task: Task = {
        id: createTaskId(),
        title: action.title.trim(),
        project: action.project.trim() || "Personal",
        dueLabel: action.dueLabel.trim() || "Soon",
        estimateMinutes: clampEstimateMinutes(action.estimateMinutes),
        status: "pending",
        priority: "medium",
        source: "task",
        later: false,
      };
      return [task, ...current];
    }

    const taskExists = current.some((task) => task.id === action.taskId);
    if (!taskExists) return current;

    if (action.type === "complete_task") {
      return current.map((task) =>
        task.id === action.taskId ? { ...task, status: "completed" } : task,
      );
    }

    return current.map((task) =>
      task.id === action.taskId
        ? {
            ...task,
            dueLabel: action.dueLabel.trim() || task.dueLabel,
            dueDate: undefined,
            dueTime: undefined,
          }
        : task,
    );
  }, tasks);
}
