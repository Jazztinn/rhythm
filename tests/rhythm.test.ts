import assert from "node:assert/strict";
import test from "node:test";
import { applyAssistantActions, clampEstimateMinutes, createTaskFromDraft, seedTasks } from "../lib/rhythm.ts";

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
