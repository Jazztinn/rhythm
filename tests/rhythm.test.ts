import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAssistantActions,
  applyWorkspaceTransaction,
  clampEstimateMinutes,
  createTaskFromDraft,
  createWorkspaceState,
  migrateWorkspaceData,
  searchTasks,
  seedRhythms,
  seedTasks,
  selectRecommendedTask,
  summarizeWorkload,
  undoWorkspace,
} from "../lib/rhythm.ts";

test("completes a known task", () => {
  const next = applyAssistantActions(seedTasks, [
    {
      type: "complete_task",
      taskId: "techforgood-mockups",
      title: null,
      project: null,
      dueLabel: null,
      estimateMinutes: null,
    },
  ]);

  assert.equal(
    next.find((task) => task.id === "techforgood-mockups")?.status,
    "completed",
  );
  assert.equal(seedTasks[0].status, "pending");
});

test("reschedules a known task and ignores an unknown task", () => {
  const next = applyAssistantActions(seedTasks, [
    {
      type: "reschedule_task",
      taskId: "monday-meeting",
      title: null,
      project: null,
      dueLabel: "Tomorrow morning",
      estimateMinutes: null,
    },
    {
      type: "complete_task",
      taskId: "does-not-exist",
      title: null,
      project: null,
      dueLabel: null,
      estimateMinutes: null,
    },
  ]);

  assert.equal(
    next.find((task) => task.id === "monday-meeting")?.dueLabel,
    "Tomorrow morning",
  );
  assert.equal(next.find((task) => task.id === "monday-meeting")?.dueTime, undefined);
  assert.equal(next.length, seedTasks.length);
});

test("creates a fully scheduled task from editor data", () => {
  const task = createTaskFromDraft({
    title: "  Ship the release  ",
    project: "Rhythm",
    dueDate: "2026-08-08",
    dueTime: "18:00",
    estimateMinutes: 45,
    priority: "high",
    later: false,
    note: "Final check",
  }, "task-editor-test");

  assert.equal(task.id, "task-editor-test");
  assert.equal(task.title, "Ship the release");
  assert.equal(task.dueDate, "2026-08-08");
  assert.equal(task.dueTime, "18:00");
  assert.equal(task.priority, "high");
});

test("creates a bounded local task", () => {
  const next = applyAssistantActions(seedTasks, [
    {
      type: "create_task",
      taskId: null,
      title: "Review portfolio",
      project: "Growth",
      dueLabel: "Tonight",
      estimateMinutes: 30,
    },
  ], { createTaskId: () => "task-test-id" });

  assert.equal(next.length, seedTasks.length + 1);
  assert.equal(next[0].id, "task-test-id");
  assert.equal(next[0].title, "Review portfolio");
  assert.equal(next[0].status, "pending");
});

test("clamps local estimates deterministically", () => {
  assert.equal(clampEstimateMinutes(1), 5);
  assert.equal(clampEstimateMinutes(30), 30);
  assert.equal(clampEstimateMinutes(900), 480);
});

test("migrates both legacy local payloads into one V3 workspace", () => {
  const result = migrateWorkspaceData(
    null,
    [seedTasks[0]],
    { date: "2026-08-09", routines: [seedRhythms[0]], done: ["morning"] },
  );

  assert.equal(result.status, "migrated-both");
  assert.equal(result.recoverable, false);
  assert.equal(result.state.version, 3);
  assert.equal(result.state.tasks[0].id, seedTasks[0].id);
  assert.equal(result.state.rhythms[0].id, "morning");
  assert.deepEqual(result.state.completions["2026-08-09"], ["morning"]);
});

test("keeps corrupt V3 data recoverable instead of treating it as empty", () => {
  const result = migrateWorkspaceData({ version: 3, tasks: "not an array" }, null, null);
  assert.equal(result.status, "corrupt");
  assert.equal(result.recoverable, true);
  assert.equal(result.state.tasks.length, seedTasks.length);
});

test("preserves labeled undo history through serialization", () => {
  const initial = createWorkspaceState([seedTasks[0]], []);
  const changed = applyWorkspaceTransaction(initial, "Completed task", (current) => ({
    ...current,
    tasks: [{ ...current.tasks[0], status: "completed" }],
  }), "2026-08-09T10:00:00.000Z");
  const reloaded = JSON.parse(JSON.stringify(changed));
  assert.equal(reloaded.history[0].label, "Completed task");
  assert.equal(undoWorkspace(reloaded).tasks[0].status, "pending");
});

test("selects an evidence-backed recommended task and indexes notes", () => {
  const now = new Date("2026-08-09T09:00:00");
  const tasks = [
    { ...seedTasks[0], id: "later-task", dueDate: "2026-08-10", dueTime: "08:00", later: false },
    { ...seedTasks[0], id: "high-task", title: "Send the launch note", dueDate: "2026-08-09", dueTime: "10:00", priority: "high" as const, later: false },
  ];
  assert.equal(selectRecommendedTask(tasks, now)?.id, "high-task");
  assert.equal(searchTasks(tasks, "launch note")[0].id, "high-task");
  assert.equal(searchTasks([{ ...tasks[0], note: "Final launch checklist" }], "checklist")[0].id, "later-task");
});

test("summaries stay truthful for zero, overloaded, disconnected, and partial evidence", () => {
  assert.match(summarizeWorkload([]).statement, /Based on your tasks only: 0 open tasks, 0 minutes planned/);
  const overloaded = summarizeWorkload(Array.from({ length: 10 }, (_, index) => ({ ...seedTasks[0], id: `overload-${index}`, estimateMinutes: 60 })));
  assert.equal(overloaded.plannedMinutes, 600);
  assert.match(overloaded.statement, /Based on your tasks only/);
  assert.equal(summarizeWorkload(seedTasks, { status: "disconnected" }).evidence, "tasks-only");
  assert.equal(summarizeWorkload(seedTasks, { status: "partial", scheduledMinutes: 120 }).evidence, "partial-calendar");
  assert.match(summarizeWorkload(seedTasks, { status: "partial" }).statement, /partial calendar evidence/);
});
