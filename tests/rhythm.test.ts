import assert from "node:assert/strict";
import test from "node:test";
import {
  applyAiActionProposals,
  applyAssistantActions,
  applyWorkspaceTransaction,
  addDays,
  clampEstimateMinutes,
  createTaskFromDraft,
  createWorkspaceState,
  generateOccurrences,
  migrateWorkspaceData,
  rhythmOccurrenceId,
  searchTasks,
  seedRhythms,
  seedTasks,
  selectRecommendedTask,
  summarizeWorkload,
  taskTargetSummary,
  toDateKey,
  undoWorkspace,
  validateAiProposals,
  type AiActionProposal,
  type RhythmWeekday,
} from "../lib/rhythm.ts";

const dailyRhythm = {
  id: "daily-test",
  title: "Read a page",
  note: "A small reset",
  schedule: { frequency: "daily" as const },
  startsOn: "2026-08-01",
  localTime: "08:30",
  icon: "sun" as const,
  tone: "lime" as const,
  project: "Personal",
  estimateMinutes: 15,
  priority: "low" as const,
};

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

test("generates daily occurrences with inclusive boundaries and stable IDs", () => {
  const items = generateOccurrences([dailyRhythm], [], [], "2026-08-09", "2026-08-11");
  assert.deepEqual(items.map((item) => item.occurrenceDate), ["2026-08-09", "2026-08-10", "2026-08-11"]);
  assert.deepEqual(items.map((item) => item.id), items.map((item) => rhythmOccurrenceId("daily-test", item.occurrenceDate!)));
  assert.equal(items.every((item) => item.generated && item.source === "rhythm" && item.dueTime === "08:30"), true);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
});

test("generates weekly occurrences only on selected local weekdays", () => {
  const rhythm = { ...dailyRhythm, id: "weekly-test", schedule: { frequency: "weekly" as const, weekdays: [1, 3] as RhythmWeekday[] } };
  const items = generateOccurrences([rhythm], [], [], "2026-08-09", "2026-08-16");
  assert.deepEqual(items.map((item) => item.occurrenceDate), ["2026-08-10", "2026-08-12", "2026-08-17"].filter((date) => date <= "2026-08-16"));
});

test("paused, archived, skipped, and completed occurrences classify correctly", () => {
  const paused = { ...dailyRhythm, id: "paused", paused: true };
  const archived = { ...dailyRhythm, id: "archived", archived: true };
  const items = generateOccurrences([dailyRhythm, paused, archived], [{ rhythmId: "daily-test", occurrenceDate: "2026-08-10", kind: "skip" }], [{ rhythmId: "daily-test", occurrenceDate: "2026-08-11" }], "2026-08-09", "2026-08-11");
  assert.deepEqual(items.map((item) => item.occurrenceDate), ["2026-08-09", "2026-08-11"]);
  assert.equal(items.find((item) => item.occurrenceDate === "2026-08-11")?.status, "completed");
  assert.equal(items.some((item) => item.rhythmId === "paused" || item.rhythmId === "archived"), false);
});

test("rescheduling suppresses the original date and keeps one stable identity", () => {
  const exception = { rhythmId: "daily-test", occurrenceDate: "2026-08-01", kind: "reschedule" as const, replacementDate: "2026-08-05", replacementTime: "19:00" };
  const items = generateOccurrences([dailyRhythm], [exception], [], "2026-08-05", "2026-08-05");
  const rescheduled = items.find((item) => item.id === "rhythm:daily-test:2026-08-01");
  assert.equal(items.length, 2);
  assert.equal(rescheduled?.occurrenceDate, "2026-08-01");
  assert.equal(rescheduled?.dueDate, "2026-08-05");
  assert.equal(rescheduled?.dueTime, "19:00");
  assert.equal(generateOccurrences([dailyRhythm], [exception], [], "2026-08-01", "2026-08-05").filter((item) => item.id === rescheduled?.id).length, 1);
});

test("rescheduled work coexists with the natural occurrence on its replacement date", () => {
  const exception = { rhythmId: "daily-test", occurrenceDate: "2026-08-01", kind: "reschedule" as const, replacementDate: "2026-08-02" };
  const items = generateOccurrences([dailyRhythm], [exception], [], "2026-08-01", "2026-08-02");
  assert.deepEqual(items.map((item) => item.id), ["rhythm:daily-test:2026-08-01", "rhythm:daily-test:2026-08-02"]);
  assert.deepEqual(items.map((item) => item.dueDate), ["2026-08-02", "2026-08-02"]);
});

test("startsOn prevents a new or normalized rhythm from backfilling overdue dates", () => {
  const newRhythm = { ...dailyRhythm, id: "new-rhythm", startsOn: "2026-08-10" };
  assert.deepEqual(generateOccurrences([newRhythm], [], [], "2026-08-01", "2026-08-11").map((item) => item.occurrenceDate), ["2026-08-10", "2026-08-11"]);

  const legacy = { id: "normalized-rhythm", title: "Normalized", note: "No backfill", time: "07:00", icon: "sun", tone: "lime" };
  const normalized = migrateWorkspaceData(null, null, { routines: [legacy] }).state.rhythms[0];
  const today = toDateKey(new Date());
  const yesterday = toDateKey(addDays(new Date(), -1));
  assert.equal(normalized.startsOn, today);
  assert.deepEqual(generateOccurrences([normalized], [], [], yesterday, today).map((item) => item.occurrenceDate), [today]);
});

test("normalizes old V3 rhythms without changing version or losing completion state", () => {
  const oldRhythm = { id: "legacy", title: "Legacy", note: "Keep it", time: "07:00", icon: "sun", tone: "lime" };
  const old = {
    version: 3,
    tasks: [],
    rhythms: [oldRhythm],
    exceptions: { legacy: ["2026-08-10"] },
    completions: { "2026-08-09": ["legacy"] },
    settings: { starterDataAvailable: true, displayName: "Jazz Tinn" },
    history: [],
  };
  const result = migrateWorkspaceData(old, null, null);
  assert.equal(result.status, "v3");
  assert.equal(result.state.version, 3);
  assert.deepEqual(result.state.rhythms[0].schedule, { frequency: "daily" });
  assert.equal(result.state.rhythms[0].localTime, "07:00");
  assert.equal(result.state.rhythms[0].startsOn, toDateKey(new Date()));
  assert.deepEqual(result.state.rhythmExceptions, [{ rhythmId: "legacy", occurrenceDate: "2026-08-10", kind: "skip" }]);
  assert.deepEqual(result.state.rhythmCompletions, [{ rhythmId: "legacy", occurrenceDate: "2026-08-09" }]);
});

test("rhythm transaction snapshots restore occurrence state through undo", () => {
  const initial = createWorkspaceState([], [dailyRhythm]);
  const changed = applyWorkspaceTransaction(initial, "Skipped occurrence", (current) => ({
    ...current,
    rhythmExceptions: [{ rhythmId: "daily-test", occurrenceDate: "2026-08-09", kind: "skip" }],
  }), "2026-08-09T10:00:00.000Z");
  assert.equal(changed.rhythmExceptions.length, 1);
  assert.equal(undoWorkspace(changed).rhythmExceptions.length, 0);
});

test("proposal validation blocks low-confidence, stale, completed, and conflicting targets", () => {
  const target = seedTasks[0];
  const proposal = (action: AiActionProposal["action"], confidence = 0.99): AiActionProposal => ({
    id: crypto.randomUUID(), action, targetSummary: taskTargetSummary(target), confidence, reason: "Test provenance", status: "pending",
  });
  const result = validateAiProposals([
    proposal({ type: "complete_task", taskId: "does-not-exist", title: null, project: null, dueLabel: null, estimateMinutes: null }),
    proposal({ type: "complete_task", taskId: "review-abstract", title: null, project: null, dueLabel: null, estimateMinutes: null }),
    proposal({ type: "complete_task", taskId: target.id, title: null, project: null, dueLabel: null, estimateMinutes: null }, 0.4),
    proposal({ type: "complete_task", taskId: target.id, title: null, project: null, dueLabel: null, estimateMinutes: null }),
    proposal({ type: "reschedule_task", taskId: target.id, title: null, project: null, dueLabel: "Tomorrow", estimateMinutes: null }),
  ], seedTasks);
  assert.equal(result.ok, false);
  assert.equal(result.valid.length, 1);
  assert.match(result.issues.join(" "), /current workspace|already complete|certainty|conflicting/i);
});

test("generated occurrence proposals use occurrence semantics and one undo snapshot", () => {
  const state = createWorkspaceState([], [dailyRhythm]);
  const occurrence: AiActionProposal = {
    id: "complete-occurrence", action: { type: "complete_task", taskId: "rhythm:daily-test:2026-08-09", title: null, project: null, dueLabel: null, estimateMinutes: null },
    targetSummary: "“Read a page” · Rhythm occurrence · Today", confidence: 0.99, reason: "Exact generated occurrence", status: "pending",
  };
  const moved: AiActionProposal = {
    id: "move-occurrence", action: { type: "reschedule_task", taskId: "rhythm:daily-test:2026-08-10", title: null, project: null, dueLabel: "Friday", estimateMinutes: null, dueDate: "2026-08-14" },
    targetSummary: "“Read a page” · Rhythm occurrence · Tomorrow", confidence: 0.99, reason: "Exact generated occurrence", status: "pending",
  };
  const next = applyAiActionProposals(state, [occurrence, moved]);
  assert.equal(next.tasks.length, 0);
  assert.equal(next.rhythmCompletions[0].occurrenceDate, "2026-08-09");
  assert.deepEqual(next.rhythmExceptions[0], { rhythmId: "daily-test", occurrenceDate: "2026-08-10", kind: "reschedule", replacementDate: "2026-08-14" });
  assert.equal(next.history.length, 0);
  const transaction = applyWorkspaceTransaction(state, "Approved Rhythm proposal batch", (current) => applyAiActionProposals(current, [occurrence, moved]));
  assert.equal(transaction.history.length, 1);
  assert.equal(undoWorkspace(transaction).rhythmCompletions.length, 0);
});
