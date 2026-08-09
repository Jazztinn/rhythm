import assert from "node:assert/strict";
import test from "node:test";
import {
  addInference,
  answerPattern,
  canPatternInfluence,
  confirmedPatterns,
  createLearningState,
  editPattern,
  inferPattern,
  migrateLearningState,
  removePattern,
  seedLearningState,
  setCategoryPaused,
  type PatternInference,
} from "../lib/learning.ts";

const inference: PatternInference = {
  id: "admin-time",
  category: "Task categories",
  subject: "Admin work",
  value: "6–8 PM",
  question: "I’ve noticed admin work often happens between 6–8 PM. Is that accurate?",
  evidence: { count: 6, sampleSize: 8, summary: "Observed on 6 of 8 recent days.", sources: ["tasks"] },
  inferredAt: "2026-08-09T10:00:00.000Z",
};

test("new inference starts unconfirmed and cannot influence recommendations", () => {
  const pattern = inferPattern(inference);
  const state = createLearningState([pattern]);
  assert.equal(pattern.status, "still-learning");
  assert.equal(canPatternInfluence(state, pattern), false);
  assert.deepEqual(confirmedPatterns(state), []);
});

test("yes confirms; sometimes remains contextual and cannot drive behavior", () => {
  const initial = createLearningState([inferPattern(inference)]);
  const yes = answerPattern(initial, inference.id, "yes", "2026-08-09T12:00:00.000Z");
  assert.equal(yes.patterns[0].status, "confirmed");
  assert.equal(canPatternInfluence(yes, yes.patterns[0]), true);

  const sometimes = answerPattern(initial, inference.id, "sometimes");
  assert.equal(sometimes.patterns[0].status, "contextual");
  assert.equal(canPatternInfluence(sometimes, sometimes.patterns[0]), false);
});

test("no suppresses weak repeats; substantial new evidence can ask again", () => {
  const rejected = answerPattern(createLearningState([inferPattern(inference)]), inference.id, "no");
  const weak = addInference(rejected, { ...inference, evidence: { ...inference.evidence, count: 8, sampleSize: 10 } });
  assert.equal(weak.patterns[0].status, "rejected");
  const substantial = addInference(rejected, { ...inference, evidence: { ...inference.evidence, count: 10, sampleSize: 12 } });
  assert.equal(substantial.patterns[0].status, "still-learning");
});

test("keep observing collects evidence but does not influence recommendations", () => {
  const state = answerPattern(createLearningState([inferPattern(inference)]), inference.id, "keep-observing");
  assert.equal(state.patterns[0].status, "keep-observing");
  assert.equal(confirmedPatterns(state).length, 0);
});

test("behavior change asks again without silently replacing confirmed preference", () => {
  const confirmed = answerPattern(createLearningState([inferPattern(inference)]), inference.id, "yes");
  const changed = addInference(confirmed, { ...inference, value: "3–5 PM", question: "Has your routine changed?", evidence: { ...inference.evidence, count: 7 } });
  assert.equal(changed.patterns[0].value, "6–8 PM");
  assert.equal(changed.patterns[0].pendingChange?.value, "3–5 PM");
  assert.equal(confirmedPatterns(changed)[0].value, "6–8 PM");

  const accepted = answerPattern(changed, inference.id, "yes", "2026-08-10T12:00:00.000Z");
  assert.equal(accepted.patterns[0].value, "3–5 PM");
  assert.equal(accepted.patterns[0].pendingChange, undefined);
});

test("editing is explicit confirmation; remove and category pause are reversible", () => {
  const initial = createLearningState([inferPattern(inference)]);
  const edited = editPattern(initial, inference.id, "7–9 PM");
  assert.equal(edited.patterns[0].status, "confirmed");
  assert.equal(edited.patterns[0].value, "7–9 PM");
  const paused = setCategoryPaused(edited, inference.category, true);
  assert.equal(confirmedPatterns(paused).length, 0);
  const resumed = setCategoryPaused(paused, inference.category, false);
  assert.equal(confirmedPatterns(resumed).length, 1);
  assert.equal(removePattern(resumed, inference.id).patterns.length, 0);
});

test("migration recovers corrupt data and normalizes older safe data", () => {
  assert.equal(migrateLearningState("bad").status, "recovered");
  assert.ok(migrateLearningState("bad").state.patterns.every((pattern) => pattern.status === "still-learning"));
  const migrated = migrateLearningState({ enabled: false, patterns: [inferPattern(inference)], pausedCategories: ["Task categories", 4] });
  assert.equal(migrated.status, "migrated");
  assert.equal(migrated.state.enabled, false);
  assert.deepEqual(migrated.state.pausedCategories, ["Task categories"]);
});

test("seed observations are visibly still learning, never hidden defaults", () => {
  assert.ok(seedLearningState.patterns.length > 0);
  assert.ok(seedLearningState.patterns.every((pattern) => pattern.status === "still-learning"));
  assert.equal(confirmedPatterns(seedLearningState).length, 0);
});
