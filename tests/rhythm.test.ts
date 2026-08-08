import assert from "node:assert/strict";
import test from "node:test";
import { applyAssistantActions, seedTasks } from "../lib/rhythm.ts";

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
  assert.equal(next.length, seedTasks.length);
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
  ]);

  assert.equal(next.length, seedTasks.length + 1);
  assert.equal(next[0].title, "Review portfolio");
  assert.equal(next[0].status, "pending");
});
