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
  const response = await POST(request(payload));
  if (prior) process.env.GEMINI_API_KEY = prior;

  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).actions, [
    { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday", estimateMinutes: null },
  ]);
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

test("sanitizes invalid IDs, duplicate mutations, completed tasks, and malformed action fields", async () => {
  provider = async () => ({
    text: JSON.stringify({
      message: "I kept only safe changes.", suggestions: [], actions: [
        { type: "complete_task", taskId: "does-not-exist", title: null, project: null, dueLabel: null, estimateMinutes: null },
        { type: "complete_task", taskId: "review-abstract", title: null, project: null, dueLabel: null, estimateMinutes: null },
        { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null },
        { type: "complete_task", taskId: "monday-meeting", title: null, project: null, dueLabel: null, estimateMinutes: null },
      ],
    }),
  });

  const response = await POST(request(payload));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).actions, [
    { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null },
  ]);
});

test("uses Gemini structured JSON and returns only safe task actions", async () => {
  process.env.GEMINI_MODEL = "test-model";
  provider = async () => ({
    text: JSON.stringify({
      message: "Move it to Friday morning, then stop there.", suggestions: ["What can wait until Monday?"], actions: [
        { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null },
        { type: "complete_task", taskId: "unknown-task", title: null, project: null, dueLabel: null, estimateMinutes: null },
      ],
    }),
  });

  const response = await POST(request(payload));
  assert.equal(response.status, 200);
  assert.equal(sent?.model, "test-model");
  assert.equal(sent?.config.responseMimeType, "application/json");
  assert.match(sent?.config.systemInstruction ?? "", /untrusted context/);
  assert.deepEqual((await response.json()).actions, [
    { type: "reschedule_task", taskId: "monday-meeting", title: null, project: null, dueLabel: "Friday morning", estimateMinutes: null },
  ]);
  delete process.env.GEMINI_MODEL;
});

test("returns calm error on Gemini provider or response failures", async () => {
  provider = async () => { throw new Error("provider unavailable"); };
  const response = await POST(request(payload));

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: "Rhythm is taking a quiet moment. Please try again shortly.",
  });
});
