import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { seedTasks } from "../lib/rhythm.ts";

type GeminiRequest = {
  model: string;
  config: {
    systemInstruction: string;
    responseMimeType: string;
  };
};

let sent: GeminiRequest | undefined;
let provider: () => Promise<{ text?: string | null }> = async () => ({ text: "{}" });

await mock.module("@google/genai", {
  namedExports: {
    GoogleGenAI: class {
      models = {
        generateContent: async (input: GeminiRequest) => {
          sent = input;
          return provider();
        },
      };
    },
  },
});

const { POST } = await import("../app/api/chat/route.ts");

const payload = {
  messages: [{ role: "user", content: "Move Monday prep to Friday." }],
  tasks: seedTasks,
  date: "2026-08-08T08:00:00.000Z",
  timezone: "Asia/Manila",
};

function request(body: unknown, headers?: HeadersInit) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("uses the local assistant without a Gemini key", async () => {
  const prior = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const before = JSON.stringify(seedTasks);
  const response = await POST(request(payload));
  if (prior) process.env.GEMINI_API_KEY = prior;

  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.actions, undefined);
  assert.deepEqual(result.proposals.map((proposal: { action: unknown }) => proposal.action), [
    { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday", estimateMinutes: null },
  ]);
  assert.match(result.proposals[0].targetSummary, /Prepare for Monday meeting/);
  assert.equal(result.proposals[0].status, "pending");
  assert.equal(JSON.stringify(seedTasks), before);
});

test("rejects malformed and oversized route payloads before provider call", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  let called = 0;
  provider = async () => {
    called += 1;
    return { text: "{}" };
  };

  const malformed = await POST(request("not json"));
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "That message could not be read." });

  const duplicateTask = await POST(request({ ...payload, tasks: [seedTasks[0], seedTasks[0]] }));
  assert.equal(duplicateTask.status, 400);

  const oversized = await POST(request(payload, { "content-length": "32001" }));
  assert.equal(oversized.status, 400);
  assert.equal(called, 0);
});

test("sanitizes invalid IDs, duplicate mutations, completed tasks, and malformed proposal fields", async () => {
  provider = async () => ({
    text: JSON.stringify({
      message: "I kept only safe changes.", suggestions: [], proposals: [
        { id: "unknown", confidence: 0.99, reason: "Unknown target", action: { type: "complete_task", taskId: "does-not-exist", title: null, project: null, dueLabel: null, estimateMinutes: null } },
        { id: "completed", confidence: 0.99, reason: "Completed target", action: { type: "complete_task", taskId: "review-abstract", title: null, project: null, dueLabel: null, estimateMinutes: null } },
        { id: "move", confidence: 0.99, reason: "Exact pending target", action: { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null } },
        { id: "complete", confidence: 0.99, reason: "Conflicting mutation", action: { type: "complete_task", taskId: "monday-meeting", title: null, project: null, dueLabel: null, estimateMinutes: null } },
      ],
    }),
  });

  const response = await POST(request(payload));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.proposals.map((proposal: { action: unknown }) => proposal.action), [
    { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null },
  ]);
  assert.match(result.clarifications.join(" "), /no longer available|conflicting/i);
});

test("uses Gemini structured JSON and returns only safe task proposals", async () => {
  process.env.GEMINI_MODEL = "test-model";
  provider = async () => ({
    text: JSON.stringify({
      message: "I prepared a proposal for Friday morning.", suggestions: ["What can wait until Monday?"], proposals: [
        { id: "move-friday", confidence: 0.96, reason: "The exact pending task and requested day were clear.", action: { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null } },
        { id: "unknown", confidence: 0.96, reason: "Unknown target", action: { type: "complete_task", taskId: "unknown-task", title: null, project: null, dueLabel: null, estimateMinutes: null } },
      ],
    }),
  });

  const response = await POST(request(payload));
  assert.equal(response.status, 200);
  assert.equal(sent?.model, "test-model");
  assert.equal(sent?.config.responseMimeType, "application/json");
  assert.match(sent?.config.systemInstruction ?? "", /untrusted context/);
  assert.deepEqual((await response.json()).proposals.map((proposal: { action: unknown }) => proposal.action), [
    { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null },
  ]);
  delete process.env.GEMINI_MODEL;
});

test("asks for clarification when current tasks have similarly named targets", async () => {
  process.env.GEMINI_API_KEY = "test-key";
  provider = async () => ({
    text: JSON.stringify({
      message: "I prepared a completion proposal.", suggestions: [], proposals: [
        { id: "ambiguous", confidence: 0.99, reason: "Matched by title", action: { type: "complete_task", taskId: "same-one", title: null, project: null, dueLabel: null, estimateMinutes: null } },
      ],
    }),
  });
  const tasks = [
    { ...seedTasks[0], id: "same-one", title: "Prepare launch notes" },
    { ...seedTasks[0], id: "same-two", title: "Prepare launch notes" },
  ];
  const response = await POST(request({ ...payload, tasks }));
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.deepEqual(result.proposals, []);
  assert.match(result.clarifications.join(" "), /similarly named/i);
});

test("returns calm error on Gemini provider or response failures", async () => {
  provider = async () => { throw new Error("provider unavailable"); };
  const response = await POST(request(payload));

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "Rhythm is taking a quiet moment. No workspace change was made; please try again shortly.",
  });
});
