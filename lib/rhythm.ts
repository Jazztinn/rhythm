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

export const seedTasks: Task[] = [
  {
    id: "techforgood-mockups",
    title: "Submit TechForGood mockups",
    project: "TechForGood",
    dueLabel: "10:00 PM",
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
): Task[] {
  return actions.reduce((current, action) => {
    if (action.type === "create_task") {
      const task: Task = {
        id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title: action.title.trim(),
        project: action.project.trim() || "Personal",
        dueLabel: action.dueLabel.trim() || "Soon",
        estimateMinutes: Math.min(Math.max(action.estimateMinutes, 5), 480),
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
        ? { ...task, dueLabel: action.dueLabel.trim() || task.dueLabel }
        : task,
    );
  }, tasks);
}
