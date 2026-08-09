export type TaskStatus = "pending" | "completed";
export type TaskPriority = "low" | "medium" | "high";
export type TaskSource = "task" | "calendar" | "slack" | "rhythm";
export type RhythmFrequency = "daily" | "weekdays" | "weekly" | "biweekly" | "monthly" | "custom";
export type RhythmWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type RhythmIntervalUnit = "day" | "week" | "month";

export type RhythmSchedule = {
  frequency: RhythmFrequency;
  weekdays?: RhythmWeekday[];
  /** Used by custom schedules. Kept bounded during normalization. */
  interval?: number;
  intervalUnit?: RhythmIntervalUnit;
};

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
  schedule: RhythmSchedule;
  startsOn: string;
  endsOn?: string;
  localTime?: string;
  icon: "sun" | "waves" | "moon" | "orbit";
  tone: "lime" | "violet" | "peach";
  project?: string;
  estimateMinutes?: number;
  priority?: TaskPriority;
  paused?: boolean;
  archived?: boolean;
  /** @deprecated Read only compatibility for pre-phase-2 V3 data. */
  time?: string;
};

export type RhythmException = {
  rhythmId: string;
  occurrenceDate: string;
  kind: "skip" | "reschedule" | "modify";
  replacementDate?: string;
  replacementTime?: string;
  changes?: RhythmOccurrenceChanges;
};

export type RhythmOccurrenceChanges = {
  title?: string;
  note?: string;
  project?: string;
  estimateMinutes?: number;
  priority?: TaskPriority;
  localTime?: string;
};

export type RhythmCompletion = {
  rhythmId: string;
  occurrenceDate: string;
  completedAt?: string;
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
  rhythmExceptions: RhythmException[];
  rhythmCompletions: RhythmCompletion[];
  settings: WorkspaceSettings;
};

export type WorkspaceStateV3 = {
  version: 3;
  tasks: Task[];
  rhythms: RhythmDefinition[];
  exceptions: Record<string, string[]>;
  completions: Record<string, string[]>;
  rhythmExceptions: RhythmException[];
  rhythmCompletions: RhythmCompletion[];
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
  proposals?: AiActionProposal[];
  clarifications?: string[];
  receipt?: AiProposalReceipt;
};

export type CreateTaskAction = {
  type: "create_task";
  taskId: null;
  title: string;
  project: string;
  dueLabel: string;
  estimateMinutes: number;
  dueDate?: string;
  dueTime?: string;
  priority?: TaskPriority;
  later?: boolean;
  note?: string;
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
  dueDate?: string;
  dueTime?: string;
};

export type AssistantAction =
  | CreateTaskAction
  | CompleteTaskAction
  | RescheduleTaskAction;

export type ChatReply = {
  message: string;
  suggestions: string[];
  proposals: AiActionProposal[];
  clarifications?: string[];
};

export type AiProposalStatus = "pending" | "approved" | "edited" | "cancelled" | "blocked";

export type AiActionProposal = {
  id: string;
  action: AssistantAction;
  targetSummary: string;
  confidence: number;
  reason: string;
  status: AiProposalStatus;
  provenance?: "local" | "gemini";
  resolution?: string;
};

export type AiProposalReceipt = {
  changed: string[];
  unchanged: string[];
  undoAvailable: boolean;
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

function dateFromKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function nextDateKey(dateKey: string) {
  return toDateKey(addDays(dateFromKey(dateKey), 1));
}

function isDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateFromKey(value);
  return !Number.isNaN(date.getTime()) && toDateKey(date) === value;
}

export function dateRangeFrom(now = new Date(), daysBefore = 365, daysAfter = 365) {
  return { start: toDateKey(addDays(now, -daysBefore)), end: toDateKey(addDays(now, daysAfter)) };
}

export type TaskInventorySelection = {
  visible: Task[];
  hiddenGeneratedOpen: number;
};

/**
 * Keep the task inventory useful when a daily Rhythm would otherwise create
 * hundreds of rows. Manual tasks always remain visible; generated work gets a
 * factual, user-expandable date window.
 */
export function selectTaskInventory(
  tasks: Task[],
  now = new Date(),
  occurrenceDays = 30,
): TaskInventorySelection {
  const range = dateRangeFrom(now, occurrenceDays, occurrenceDays);
  const visible = tasks.filter((task) => {
    if (!task.generated) return true;
    const date = task.dueDate ?? task.occurrenceDate;
    return Boolean(date && date >= range.start && date <= range.end);
  });
  const hiddenGeneratedOpen = tasks.filter((task) => {
    if (!task.generated || task.status !== "pending") return false;
    const date = task.dueDate ?? task.occurrenceDate;
    return !date || date < range.start || date > range.end;
  }).length;
  return { visible, hiddenGeneratedOpen };
}

export type AiContextTask = {
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
};

/** Build the bounded, provider-safe work context used by Ask Rhythm. */
export function buildAiContext(workItems: Task[], now = new Date(), maxItems = 120): AiContextTask[] {
  const generatedRange = dateRangeFrom(now, 30, 90);
  const unique = new Map<string, Task>();
  for (const task of workItems) {
    if (task.generated) {
      const relevantDate = task.dueDate ?? task.occurrenceDate;
      if (!relevantDate || relevantDate < generatedRange.start || relevantDate > generatedRange.end) continue;
    }
    if (!unique.has(task.id)) unique.set(task.id, task);
  }
  const ordered = [...unique.values()].sort((first, second) => {
    const statusRank = Number(first.status !== "pending") - Number(second.status !== "pending");
    const dueRank = (first.dueDate ?? first.occurrenceDate ?? "9999-12-31").localeCompare(second.dueDate ?? second.occurrenceDate ?? "9999-12-31");
    return statusRank || dueRank || Number(first.generated) - Number(second.generated) || first.id.localeCompare(second.id);
  });
  return ordered.slice(0, Math.min(120, Math.max(0, maxItems))).map((task) => ({
    id: task.id,
    title: task.title,
    project: task.project,
    dueLabel: task.dueLabel,
    estimateMinutes: task.estimateMinutes,
    status: task.status,
    priority: task.priority,
    source: task.source,
    later: task.later,
    ...(task.dueDate ? { dueDate: task.dueDate } : {}),
    ...(task.dueTime ? { dueTime: task.dueTime } : {}),
    ...(task.note ? { note: task.note } : {}),
    ...(task.rhythmId ? { rhythmId: task.rhythmId } : {}),
    ...(task.occurrenceDate ? { occurrenceDate: task.occurrenceDate } : {}),
    ...(task.generated ? { generated: true } : {}),
  }));
}

export function rhythmOccurrenceId(rhythmId: string, occurrenceDate: string) {
  return `rhythm:${rhythmId}:${occurrenceDate}`;
}

function exceptionList(value: RhythmException[] | Record<string, string[]>) {
  return Array.isArray(value) ? value : recordsToExceptions(value);
}

function completionList(value: RhythmCompletion[] | Record<string, string[]>) {
  return Array.isArray(value) ? value : recordsToCompletions(value);
}

export const MAX_OCCURRENCE_RANGE_DAYS = 370;
export const MAX_GENERATED_OCCURRENCES = 2000;

function daysBetween(start: string, end: string) {
  return Math.round((dateFromKey(end).getTime() - dateFromKey(start).getTime()) / 86_400_000);
}

function monthsBetween(start: string, end: string) {
  const first = dateFromKey(start);
  const second = dateFromKey(end);
  return (second.getFullYear() - first.getFullYear()) * 12 + second.getMonth() - first.getMonth();
}

function startOfWeek(dateKey: string) {
  const date = dateFromKey(dateKey);
  const distanceFromMonday = (date.getDay() + 6) % 7;
  return toDateKey(addDays(date, -distanceFromMonday));
}

function monthlyAnchorMatches(startsOn: string, dateKey: string, interval: number) {
  const monthDistance = monthsBetween(startsOn, dateKey);
  if (monthDistance < 0 || monthDistance % interval !== 0) return false;
  const start = dateFromKey(startsOn);
  const date = dateFromKey(dateKey);
  const finalDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === Math.min(start.getDate(), finalDay);
}

function followsSchedule(definition: RhythmDefinition, dateKey: string) {
  if (dateKey < definition.startsOn || (definition.endsOn && dateKey > definition.endsOn)) return false;
  const { frequency } = definition.schedule;
  const weekday = dateFromKey(dateKey).getDay() as RhythmWeekday;
  if (frequency === "daily") return true;
  if (frequency === "weekdays") return weekday >= 1 && weekday <= 5;
  if (frequency === "monthly") return monthlyAnchorMatches(definition.startsOn, dateKey, 1);
  if (frequency === "weekly" || frequency === "biweekly") {
    const weekDistance = Math.floor(daysBetween(startOfWeek(definition.startsOn), startOfWeek(dateKey)) / 7);
    const interval = frequency === "biweekly" ? 2 : 1;
    return weekDistance >= 0 && weekDistance % interval === 0 &&
      (definition.schedule.weekdays ?? [dateFromKey(definition.startsOn).getDay() as RhythmWeekday]).includes(weekday);
  }
  const interval = definition.schedule.interval ?? 1;
  if (definition.schedule.intervalUnit === "week") {
    const weekDistance = Math.floor(daysBetween(startOfWeek(definition.startsOn), startOfWeek(dateKey)) / 7);
    return weekDistance >= 0 && weekDistance % interval === 0 &&
      (definition.schedule.weekdays ?? [dateFromKey(definition.startsOn).getDay() as RhythmWeekday]).includes(weekday);
  }
  if (definition.schedule.intervalUnit === "month") return monthlyAnchorMatches(definition.startsOn, dateKey, interval);
  return daysBetween(definition.startsOn, dateKey) % interval === 0;
}

export function generateOccurrences(
  definitions: RhythmDefinition[],
  exceptions: RhythmException[] | Record<string, string[]>,
  completions: RhythmCompletion[] | Record<string, string[]>,
  start: string,
  end: string,
): Task[] {
  if (!isDateKey(start) || !isDateKey(end) || start > end) return [];
  const boundedEnd = [end, toDateKey(addDays(dateFromKey(start), MAX_OCCURRENCE_RANGE_DAYS - 1))].sort()[0];
  const normalizedExceptions = exceptionList(exceptions);
  const exceptionByKey = new Map(normalizedExceptions.map((exception) => [`${exception.rhythmId}:${exception.occurrenceDate}`, exception]));
  const completedKeys = new Set(completionList(completions).map((completion) => `${completion.rhythmId}:${completion.occurrenceDate}`));
  const result: Task[] = [];

  for (const rawDefinition of definitions) {
    if (result.length >= MAX_GENERATED_OCCURRENCES) break;
    const definition = normalizeRhythmDefinition(rawDefinition);
    if (definition.paused || definition.archived) continue;
    const generationStart = definition.startsOn > start ? definition.startsOn : start;
    if (generationStart > boundedEnd || (definition.endsOn && generationStart > definition.endsOn)) continue;
    const occurrenceDates = new Set<string>();
    for (let occurrenceDate = generationStart; occurrenceDate <= boundedEnd; occurrenceDate = nextDateKey(occurrenceDate)) occurrenceDates.add(occurrenceDate);
    for (const exception of normalizedExceptions) {
      if (exception.rhythmId === definition.id && exception.kind === "reschedule" && exception.occurrenceDate >= definition.startsOn && exception.replacementDate && exception.replacementDate >= start && exception.replacementDate <= boundedEnd) occurrenceDates.add(exception.occurrenceDate);
    }
    for (const occurrenceDate of [...occurrenceDates].sort()) {
      if (result.length >= MAX_GENERATED_OCCURRENCES) break;
      if (!isDateKey(occurrenceDate)) continue;
      if (!followsSchedule(definition, occurrenceDate)) continue;
      const exception = exceptionByKey.get(`${definition.id}:${occurrenceDate}`);
      if (exception?.kind === "skip") continue;
      const dueDate = exception?.kind === "reschedule" && exception.replacementDate
        ? exception.replacementDate
        : occurrenceDate;
      if (dueDate < start || dueDate > boundedEnd) continue;
      const dueTime = exception?.kind === "reschedule" && exception.replacementTime !== undefined
        ? exception.replacementTime
        : exception?.changes?.localTime ?? definition.localTime;
      const changes = exception?.changes;
      result.push({
        id: rhythmOccurrenceId(definition.id, occurrenceDate),
        title: changes?.title?.trim() || definition.title,
        project: changes?.project?.trim() || definition.project?.trim() || "Personal",
        dueLabel: formatTaskDue(dueDate, dueTime ?? ""),
        estimateMinutes: clampEstimateMinutes(changes?.estimateMinutes ?? definition.estimateMinutes ?? 25),
        status: completedKeys.has(`${definition.id}:${occurrenceDate}`) ? "completed" : "pending",
        priority: changes?.priority ?? definition.priority ?? "medium",
        source: "rhythm",
        later: false,
        dueDate,
        dueTime,
        note: changes?.note ?? definition.note,
        rhythmId: definition.id,
        occurrenceDate,
        generated: true,
      });
    }
  }
  return result;
}

export function getNextRhythmOccurrence(definition: RhythmDefinition, start = toDateKey(new Date())) {
  const normalized = normalizeRhythmDefinition(definition);
  if (normalized.paused || normalized.archived || !isDateKey(start)) return null;
  const firstDate = start < normalized.startsOn ? normalized.startsOn : start;
  for (let date = firstDate, count = 0; count < MAX_OCCURRENCE_RANGE_DAYS; date = nextDateKey(date), count += 1) {
    if (followsSchedule(normalized, date)) return date;
  }
  return null;
}

/** Split one recurring entity without rewriting any earlier occurrence. */
export function splitRhythmDefinition(
  definition: RhythmDefinition,
  fromDate: string,
  future: RhythmDefinition,
  futureId = `${definition.id}-from-${fromDate}`,
) {
  const current = normalizeRhythmDefinition(definition);
  if (!isDateKey(fromDate) || fromDate <= current.startsOn || (current.endsOn && fromDate > current.endsOn)) return null;
  const pastEndsOn = toDateKey(addDays(dateFromKey(fromDate), -1));
  const past = normalizeRhythmDefinition({ ...current, endsOn: pastEndsOn });
  const next = normalizeRhythmDefinition({
    ...future,
    id: futureId,
    startsOn: fromDate,
    ...(current.endsOn ? { endsOn: current.endsOn } : {}),
    archived: false,
  });
  return { past, future: next };
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
  const weekdays: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };
  const weekday = Object.entries(weekdays).find(([name]) => label.includes(name));
  if (weekday) {
    const distance = (weekdays[weekday[0]] - now.getDay() + 7) % 7 || 7;
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
];

export const seedRhythms: RhythmDefinition[] = [
  { id: "morning", title: "Start softly", note: "Water, sunlight, no inbox", schedule: { frequency: "daily" }, startsOn: toDateKey(new Date()), localTime: "08:00", icon: "sun", tone: "lime", project: "Personal", estimateMinutes: 15, priority: "low" },
  { id: "focus", title: "Protect one deep block", note: "One important thing, fully present", schedule: { frequency: "daily" }, startsOn: toDateKey(new Date()), localTime: "10:00", icon: "waves", tone: "violet", project: "Personal", estimateMinutes: 45, priority: "medium" },
  { id: "shutdown", title: "Close the loops", note: "Review, reset, step away", schedule: { frequency: "daily" }, startsOn: toDateKey(new Date()), localTime: "20:30", icon: "moon", tone: "peach", project: "Personal", estimateMinutes: 20, priority: "low" },
  { id: "weekly-review", title: "Weekly review", note: "Close loops and shape the week ahead", schedule: { frequency: "weekly", weekdays: [0] }, startsOn: toDateKey(new Date()), localTime: "19:00", icon: "orbit", tone: "violet", project: "Personal", estimateMinutes: 25, priority: "low" },
  { id: "leetcode-session", title: "LeetCode practice", note: "One focused problem", schedule: { frequency: "weekly", weekdays: [6] }, startsOn: toDateKey(new Date()), icon: "waves", tone: "lime", project: "Growth", estimateMinutes: 45, priority: "low" },
];

const legacyRhythmTaskIds = new Set(["weekly-review", "leetcode-session"]);

function isLegacyRhythmTask(task: Task) {
  return task.source === "rhythm" && !task.rhythmId && legacyRhythmTaskIds.has(task.id);
}

export const WORKSPACE_STORAGE_KEY = "rhythm.workspace.v3";
export const LEGACY_TASKS_STORAGE_KEY = "rhythm.tasks.v1";
export const LEGACY_RHYTHMS_STORAGE_KEY = "rhythm.routines.v2";

function cloneTasks(tasks: Task[]) {
  return tasks.map((task) => ({ ...task }));
}

function cloneRhythms(rhythms: RhythmDefinition[]) {
  return rhythms.map(normalizeRhythmDefinition);
}

function cloneRecord(record: Record<string, string[]>) {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, [...value]]));
}

function cloneExceptions(exceptions: RhythmException[]) {
  return exceptions.map((exception) => ({ ...exception }));
}

function cloneCompletions(completions: RhythmCompletion[]) {
  return completions.map((completion) => ({ ...completion }));
}

function normalizeWeekdays(value: unknown, fallback: RhythmWeekday[] = [1]) {
  if (!Array.isArray(value)) return [...fallback];
  const weekdays = [...new Set(value.filter((day): day is RhythmWeekday => Number.isInteger(day) && day >= 0 && day <= 6))];
  return weekdays.length ? weekdays.sort((a, b) => a - b) : [...fallback];
}

export function normalizeRhythmDefinition(value: RhythmDefinition | Record<string, unknown>): RhythmDefinition {
  const raw = value as Record<string, unknown>;
  const defaultStartsOn = toDateKey(new Date());
  const startsOn = typeof raw.startsOn === "string" && isDateKey(raw.startsOn) ? raw.startsOn : defaultStartsOn;
  const legacyTime = typeof raw.time === "string" ? raw.time : undefined;
  const rawSchedule = isRecord(raw.schedule) ? raw.schedule : undefined;
  const frequencies: RhythmFrequency[] = ["daily", "weekdays", "weekly", "biweekly", "monthly", "custom"];
  const frequency = frequencies.includes(rawSchedule?.frequency as RhythmFrequency) ? rawSchedule?.frequency as RhythmFrequency : "daily";
  const intervalUnits: RhythmIntervalUnit[] = ["day", "week", "month"];
  const intervalUnit = intervalUnits.includes(rawSchedule?.intervalUnit as RhythmIntervalUnit) ? rawSchedule?.intervalUnit as RhythmIntervalUnit : "day";
  const interval = Math.min(365, Math.max(1, Math.round(typeof rawSchedule?.interval === "number" ? rawSchedule.interval : 1)));
  const anchorWeekday = dateFromKey(startsOn).getDay() as RhythmWeekday;
  const localTime = typeof raw.localTime === "string" ? raw.localTime : legacyTime;
  return {
    id: typeof raw.id === "string" ? raw.id : `rhythm-${Date.now()}`,
    title: typeof raw.title === "string" ? raw.title : "Untitled rhythm",
    note: typeof raw.note === "string" ? raw.note : "A small promise worth keeping",
    schedule: {
      frequency,
      ...(["weekly", "biweekly"].includes(frequency) || (frequency === "custom" && intervalUnit === "week")
        ? { weekdays: normalizeWeekdays(rawSchedule?.weekdays, [anchorWeekday]) }
        : {}),
      ...(frequency === "custom" ? { interval, intervalUnit } : {}),
    },
    startsOn,
    ...(typeof raw.endsOn === "string" && isDateKey(raw.endsOn) && raw.endsOn >= startsOn ? { endsOn: raw.endsOn } : {}),
    ...(localTime ? { localTime } : {}),
    icon: ["sun", "waves", "moon", "orbit"].includes(raw.icon as string) ? raw.icon as RhythmDefinition["icon"] : "orbit",
    tone: ["lime", "violet", "peach"].includes(raw.tone as string) ? raw.tone as RhythmDefinition["tone"] : "lime",
    ...(typeof raw.project === "string" ? { project: raw.project } : {}),
    ...(typeof raw.estimateMinutes === "number" ? { estimateMinutes: clampEstimateMinutes(raw.estimateMinutes) } : {}),
    ...(raw.priority === "low" || raw.priority === "medium" || raw.priority === "high" ? { priority: raw.priority } : {}),
    ...(typeof raw.paused === "boolean" ? { paused: raw.paused } : {}),
    ...(typeof raw.archived === "boolean" ? { archived: raw.archived } : {}),
  };
}

function defaultWorkspaceSettings(): WorkspaceSettings {
  return { starterDataAvailable: true, displayName: "Jazz Tinn" };
}

export function createWorkspaceState(
  tasks: Task[] = cloneTasks(seedTasks),
  rhythms: RhythmDefinition[] = cloneRhythms(seedRhythms),
): WorkspaceStateV3 {
  const migratedRhythms = [...rhythms];
  for (const task of tasks) {
    if (!isLegacyRhythmTask(task) || migratedRhythms.some((rhythm) => rhythm.id === task.id)) continue;
    const definition = seedRhythms.find((rhythm) => rhythm.id === task.id);
    if (definition) migratedRhythms.push(definition);
  }
  return {
    version: 3,
    // Occurrences are projections, never durable task rows.
    tasks: cloneTasks(tasks.filter((task) => !task.generated && !isLegacyRhythmTask(task))),
    rhythms: cloneRhythms(migratedRhythms),
    exceptions: {},
    completions: {},
    rhythmExceptions: [],
    rhythmCompletions: [],
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
  const hasSchedule = isRecord(value.schedule) && ["daily", "weekdays", "weekly", "biweekly", "monthly", "custom"].includes(value.schedule.frequency as string);
  const hasLegacyTime = typeof value.time === "string";
  return typeof value.id === "string" && typeof value.title === "string" &&
    typeof value.note === "string" && (hasSchedule || hasLegacyTime) &&
    (value.startsOn === undefined || (typeof value.startsOn === "string" && isDateKey(value.startsOn))) &&
    (value.endsOn === undefined || (typeof value.endsOn === "string" && isDateKey(value.endsOn))) &&
    ["sun", "waves", "moon", "orbit"].includes(value.icon as string) &&
    ["lime", "violet", "peach"].includes(value.tone as string);
}

function isRhythmException(value: unknown): value is RhythmException {
  return isRecord(value) && typeof value.rhythmId === "string" && typeof value.occurrenceDate === "string" &&
    (value.kind === "skip" || value.kind === "reschedule" || value.kind === "modify") &&
    (value.replacementDate === undefined || typeof value.replacementDate === "string") &&
    (value.replacementTime === undefined || typeof value.replacementTime === "string") &&
    (value.changes === undefined || isRecord(value.changes));
}

function isRhythmCompletion(value: unknown): value is RhythmCompletion {
  return isRecord(value) && typeof value.rhythmId === "string" && typeof value.occurrenceDate === "string" &&
    (value.completedAt === undefined || typeof value.completedAt === "string");
}

function isStringRecord(value: unknown): value is Record<string, string[]> {
  return isRecord(value) && Object.values(value).every((entry) => Array.isArray(entry) && entry.every((item) => typeof item === "string"));
}

function isWorkspaceSnapshot(value: unknown): value is WorkspaceSnapshot {
  return isRecord(value) && typeof value.label === "string" && typeof value.createdAt === "string" &&
    Array.isArray(value.tasks) && value.tasks.every(isTask) &&
    Array.isArray(value.rhythms) && value.rhythms.every(isRhythmDefinition) &&
    isStringRecord(value.exceptions) && isStringRecord(value.completions) &&
    (value.rhythmExceptions === undefined || (Array.isArray(value.rhythmExceptions) && value.rhythmExceptions.every(isRhythmException))) &&
    (value.rhythmCompletions === undefined || (Array.isArray(value.rhythmCompletions) && value.rhythmCompletions.every(isRhythmCompletion))) &&
    isRecord(value.settings) && typeof value.settings.starterDataAvailable === "boolean" &&
    typeof value.settings.displayName === "string";
}

export function isWorkspaceStateV3(value: unknown): value is WorkspaceStateV3 {
  return isRecord(value) && value.version === 3 && Array.isArray(value.tasks) && value.tasks.every(isTask) &&
    Array.isArray(value.rhythms) && value.rhythms.every(isRhythmDefinition) &&
    isStringRecord(value.exceptions) && isStringRecord(value.completions) &&
    (value.rhythmExceptions === undefined || (Array.isArray(value.rhythmExceptions) && value.rhythmExceptions.every(isRhythmException))) &&
    (value.rhythmCompletions === undefined || (Array.isArray(value.rhythmCompletions) && value.rhythmCompletions.every(isRhythmCompletion))) &&
    isRecord(value.settings) && typeof value.settings.starterDataAvailable === "boolean" &&
    typeof value.settings.displayName === "string" && Array.isArray(value.history) &&
    value.history.length <= 10 && value.history.every(isWorkspaceSnapshot);
}

function recordsToExceptions(record: Record<string, string[]>): RhythmException[] {
  return Object.entries(record).flatMap(([rhythmId, dates]) => dates.map((occurrenceDate) => ({ rhythmId, occurrenceDate, kind: "skip" as const })));
}

function recordsToCompletions(record: Record<string, string[]>) {
  return Object.entries(record).flatMap(([occurrenceDate, rhythmIds]) => rhythmIds.map((rhythmId) => ({ rhythmId, occurrenceDate })));
}

function completionsToRecord(completions: RhythmCompletion[]) {
  return completions.reduce<Record<string, string[]>>((record, completion) => {
    record[completion.occurrenceDate] ??= [];
    if (!record[completion.occurrenceDate].includes(completion.rhythmId)) record[completion.occurrenceDate].push(completion.rhythmId);
    return record;
  }, {});
}

function normalizeWorkspaceState(value: WorkspaceStateV3): WorkspaceStateV3 {
  const normalizedRhythms = cloneRhythms(value.rhythms);
  for (const task of value.tasks) {
    if (!isLegacyRhythmTask(task) || normalizedRhythms.some((rhythm) => rhythm.id === task.id)) continue;
    const definition = seedRhythms.find((rhythm) => rhythm.id === task.id);
    if (definition) normalizedRhythms.push(normalizeRhythmDefinition(definition));
  }
  let rhythmExceptions = Array.isArray((value as Partial<WorkspaceStateV3>).rhythmExceptions)
    ? cloneExceptions(value.rhythmExceptions)
    : recordsToExceptions(value.exceptions);
  let rhythmCompletions = Array.isArray((value as Partial<WorkspaceStateV3>).rhythmCompletions)
    ? cloneCompletions(value.rhythmCompletions)
    : recordsToCompletions(value.completions);
  for (const task of value.tasks) {
    if (!task.generated || !task.rhythmId || !task.occurrenceDate || !isDateKey(task.occurrenceDate)) continue;
    const keyMatches = (item: { rhythmId: string; occurrenceDate: string }) => item.rhythmId === task.rhythmId && item.occurrenceDate === task.occurrenceDate;
    if (task.status === "completed" && !rhythmCompletions.some(keyMatches)) {
      rhythmCompletions = [...rhythmCompletions, { rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate }];
    }
    if (task.dueDate && task.dueDate !== task.occurrenceDate && !rhythmExceptions.some(keyMatches)) {
      rhythmExceptions = [...rhythmExceptions, { rhythmId: task.rhythmId, occurrenceDate: task.occurrenceDate, kind: "reschedule", replacementDate: task.dueDate, ...(task.dueTime ? { replacementTime: task.dueTime } : {}) }];
    }
  }
  return {
    ...value,
    tasks: cloneTasks(value.tasks.filter((task) => !task.generated && !isLegacyRhythmTask(task))),
    rhythms: normalizedRhythms,
    exceptions: cloneRecord(value.exceptions),
    completions: { ...cloneRecord(value.completions), ...completionsToRecord(rhythmCompletions) },
    rhythmExceptions,
    rhythmCompletions,
    history: value.history.map((snapshot) => ({
      ...snapshot,
      tasks: cloneTasks(snapshot.tasks.filter((task) => !task.generated && !isLegacyRhythmTask(task))),
      rhythms: cloneRhythms(snapshot.rhythms),
      exceptions: cloneRecord(snapshot.exceptions),
      completions: cloneRecord(snapshot.completions),
      rhythmExceptions: Array.isArray(snapshot.rhythmExceptions) ? cloneExceptions(snapshot.rhythmExceptions) : recordsToExceptions(snapshot.exceptions),
      rhythmCompletions: Array.isArray(snapshot.rhythmCompletions) ? cloneCompletions(snapshot.rhythmCompletions) : recordsToCompletions(snapshot.completions),
    })),
  };
}

export function migrateWorkspaceData(
  v3Value: unknown,
  legacyTasksValue: unknown,
  legacyRhythmsValue: unknown,
): { state: WorkspaceStateV3; status: WorkspaceMigrationStatus; recoverable: boolean } {
  if (v3Value !== null && v3Value !== undefined) {
    if (isWorkspaceStateV3(v3Value)) {
      return { state: normalizeWorkspaceState(v3Value), status: "v3", recoverable: false };
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
    state.rhythmCompletions = recordsToCompletions(state.completions);
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
    rhythmExceptions: cloneExceptions(state.rhythmExceptions),
    rhythmCompletions: cloneCompletions(state.rhythmCompletions),
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
    rhythmExceptions: cloneExceptions(snapshot.rhythmExceptions ?? recordsToExceptions(snapshot.exceptions)),
    rhythmCompletions: cloneCompletions(snapshot.rhythmCompletions ?? recordsToCompletions(snapshot.completions)),
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
        priority: action.priority ?? "medium",
        source: "task",
        later: action.later ?? false,
        ...(action.dueDate ? { dueDate: action.dueDate } : {}),
        ...(action.dueTime ? { dueTime: action.dueTime } : {}),
        ...(action.note ? { note: action.note.trim() } : {}),
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
            ...(action.dueDate ? { dueDate: action.dueDate } : { dueDate: undefined }),
            ...(action.dueTime ? { dueTime: action.dueTime } : { dueTime: undefined }),
          }
        : task,
    );
  }, tasks);
}

export function taskTargetSummary(task: Task) {
  const provenance = task.generated ? "Rhythm occurrence" : task.source === "calendar" ? "Calendar" : task.project;
  return `“${task.title}” · ${provenance} · ${task.dueLabel}`;
}

export type ProposalValidation = {
  ok: boolean;
  issue?: string;
  target?: Task;
};

function proposalActionFingerprint(action: AssistantAction) {
  return JSON.stringify(action);
}

export function validateAiProposal(proposal: AiActionProposal, workItems: Task[]): ProposalValidation {
  if (proposal.status !== "pending" && proposal.status !== "edited") return { ok: false, issue: "This proposal is no longer pending." };
  if (!Number.isFinite(proposal.confidence) || proposal.confidence < 0.8) return { ok: false, issue: "Rhythm needs more certainty before suggesting this change." };

  if (proposal.action.type === "create_task") {
    if (proposal.action.taskId !== null || !proposal.action.title.trim() || !proposal.action.dueLabel.trim()) {
      return { ok: false, issue: "The new task details are incomplete." };
    }
    return { ok: true };
  }

  const matches = workItems.filter((task) => task.id === proposal.action.taskId);
  if (matches.length === 0) return { ok: false, issue: "That target is no longer in the current workspace range." };
  if (matches.length > 1) return { ok: false, issue: "That target is ambiguous. Choose the exact task before approving." };
  const target = matches[0];
  if (target.status !== "pending") return { ok: false, issue: `“${target.title}” is already complete, so Rhythm made no change.` };

  if (proposal.action.type === "complete_task") {
    if (proposal.action.title !== null || proposal.action.project !== null || proposal.action.dueLabel !== null || proposal.action.estimateMinutes !== null) {
      return { ok: false, issue: "The completion proposal contains extra fields." };
    }
  } else if (!proposal.action.dueLabel.trim()) {
    return { ok: false, issue: "The new date needs a clear day or time." };
  } else if (target.generated && !proposal.action.dueDate && !resolveTaskDate({
    id: target.id,
    title: target.title,
    project: target.project,
    dueLabel: proposal.action.dueLabel,
    estimateMinutes: target.estimateMinutes,
    status: "pending",
    priority: target.priority,
    source: "rhythm",
    later: false,
  })) {
    return { ok: false, issue: "The generated occurrence needs a concrete destination date." };
  }
  return { ok: true, target };
}

export function validateAiProposals(proposals: AiActionProposal[], workItems: Task[]) {
  const issues: string[] = [];
  const valid: AiActionProposal[] = [];
  const seenTargets = new Map<string, string>();
  for (const proposal of proposals) {
    const validation = validateAiProposal(proposal, workItems);
    if (!validation.ok) {
      issues.push(validation.issue ?? "This proposal could not be validated.");
      continue;
    }
    const key = proposal.action.type === "create_task" ? `create:${proposal.action.title.toLocaleLowerCase()}` : proposal.action.taskId;
    const fingerprint = proposalActionFingerprint(proposal.action);
    const previous = seenTargets.get(key);
    if (previous && previous !== fingerprint) {
      issues.push(`Rhythm found conflicting changes for ${validation.target ? taskTargetSummary(validation.target) : "the new task"}. Choose one proposal.`);
      continue;
    }
    if (!previous) {
      seenTargets.set(key, fingerprint);
      valid.push(proposal);
    }
  }
  return { ok: issues.length === 0, valid, issues };
}

export function applyAiActionProposals(
  state: WorkspaceStateV3,
  proposals: AiActionProposal[],
  options: ApplyAssistantActionsOptions = {},
) {
  const manualActions = proposals
    .filter((proposal) => !proposal.action.taskId || !proposal.action.taskId.startsWith("rhythm:"))
    .map((proposal) => proposal.action);
  const nextTasks = manualActions.length ? applyAssistantActions(state.tasks, manualActions, options) : state.tasks;
  let nextRhythmCompletions = state.rhythmCompletions;
  let nextRhythmExceptions = state.rhythmExceptions;
  let changed = nextTasks !== state.tasks;

  for (const proposal of proposals) {
    const { action } = proposal;
    if (!action.taskId || !action.taskId.startsWith("rhythm:")) continue;
    const [prefix, rhythmId, occurrenceDate] = action.taskId.split(":");
    if (prefix !== "rhythm" || !rhythmId || !isDateKey(occurrenceDate ?? "")) continue;
    if (action.type === "complete_task") {
      if (!nextRhythmCompletions.some((item) => item.rhythmId === rhythmId && item.occurrenceDate === occurrenceDate)) {
        nextRhythmCompletions = [...nextRhythmCompletions, { rhythmId, occurrenceDate, completedAt: new Date().toISOString() }];
        changed = true;
      }
      const dayCompletions = state.completions[occurrenceDate] ?? [];
      if (!dayCompletions.includes(rhythmId)) {
        changed = true;
        state = { ...state, completions: { ...state.completions, [occurrenceDate]: [...dayCompletions, rhythmId] } };
      }
    } else {
      const replacementDate = action.dueDate || resolveTaskDate({
        id: action.taskId,
        title: "",
        project: "",
        dueLabel: action.dueLabel,
        estimateMinutes: 5,
        status: "pending",
        priority: "medium",
        source: "rhythm",
        later: false,
      });
      if (!replacementDate) continue;
      nextRhythmExceptions = [
        ...nextRhythmExceptions.filter((item) => !(item.rhythmId === rhythmId && item.occurrenceDate === occurrenceDate)),
        { rhythmId, occurrenceDate, kind: "reschedule", replacementDate, ...(action.dueTime ? { replacementTime: action.dueTime } : {}) },
      ];
      changed = true;
    }
  }
  if (!changed) return state;
  return {
    ...state,
    tasks: nextTasks,
    rhythmCompletions: nextRhythmCompletions,
    rhythmExceptions: nextRhythmExceptions,
  };
}
