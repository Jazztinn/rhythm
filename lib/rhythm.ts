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
