import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { type AssistantAction, type Task } from "@/lib/rhythm";

export const runtime = "nodejs";

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1200),
});

const TaskSchema = z.object({
  id: z.string().max(120),
  title: z.string().max(240),
  project: z.string().max(120),
  dueLabel: z.string().max(120),
  estimateMinutes: z.number().int().min(1).max(480),
  status: z.enum(["pending", "completed"]),
  priority: z.enum(["low", "medium", "high"]),
  source: z.enum(["task", "calendar", "slack", "rhythm"]),
  later: z.boolean(),
  note: z.string().max(320).optional(),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(20),
  tasks: z.array(TaskSchema).max(80),
  date: z.string().max(80),
  timezone: z.string().max(80),
});

const ActionSchema = z.object({
  type: z.enum(["create_task", "complete_task", "reschedule_task"]),
  taskId: z.string().nullable(),
  title: z.string().nullable(),
  project: z.string().nullable(),
  dueLabel: z.string().nullable(),
  estimateMinutes: z.number().int().min(5).max(480).nullable(),
});

const ReplySchema = z.object({
  message: z.string().min(1).max(900),
  suggestions: z.array(z.string().min(1).max(120)).max(3),
  actions: z.array(ActionSchema).max(4),
});

const ReplyJsonSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
    suggestions: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    actions: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          type: {
            type: "string",
            enum: ["create_task", "complete_task", "reschedule_task"],
          },
          taskId: { type: ["string", "null"] },
          title: { type: ["string", "null"] },
          project: { type: ["string", "null"] },
          dueLabel: { type: ["string", "null"] },
          estimateMinutes: {
            type: ["integer", "null"],
            minimum: 5,
            maximum: 480,
          },
        },
        required: [
          "type",
          "taskId",
          "title",
          "project",
          "dueLabel",
          "estimateMinutes",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["message", "suggestions", "actions"],
  additionalProperties: false,
} as const;

function describeTasks(tasks: Task[]) {
  return tasks
    .map(
      (task) =>
        `- id=${task.id} | ${task.title} | ${task.status} | due=${task.dueLabel} | ${task.estimateMinutes}m | project=${task.project}${task.later ? " | later" : ""}`,
    )
    .join("\n");
}

function sanitizeActions(
  actions: z.infer<typeof ActionSchema>[],
  tasks: Task[],
): AssistantAction[] {
  const ids = new Set(tasks.map((task) => task.id));
  const sanitized: AssistantAction[] = [];

  for (const action of actions) {
    if (action.type === "create_task") {
      if (!action.title || !action.dueLabel || !action.estimateMinutes) continue;
      sanitized.push({
        type: "create_task" as const,
        taskId: null,
        title: action.title,
        project: action.project || "Personal",
        dueLabel: action.dueLabel,
        estimateMinutes: action.estimateMinutes,
      });
      continue;
    }
    if (!action.taskId || !ids.has(action.taskId)) continue;
    if (action.type === "complete_task") {
      sanitized.push({
        type: "complete_task" as const,
        taskId: action.taskId,
        title: null,
        project: null,
        dueLabel: null,
        estimateMinutes: null,
      });
      continue;
    }
    if (!action.dueLabel) continue;
    sanitized.push({
      type: "reschedule_task" as const,
      taskId: action.taskId,
      title: null,
      project: null,
      dueLabel: action.dueLabel,
      estimateMinutes: null,
    });
  }

  return sanitized;
}

export async function POST(request: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json(
      { error: "AI chat needs a GEMINI_API_KEY in your Vercel environment." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "That message could not be read." }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "That request was too large or incomplete." }, { status: 400 });
  }

  const { messages, tasks, date, timezone } = parsed.data;
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const instructions = `You are Rhythm, a calm personal chief of staff. Help the user decide what deserves attention now.

Tone: concise, warm, direct, never alarmist. Prefer a clear recommendation over a list. It is valid to tell the user they can stop working.

Current time: ${date}. Timezone: ${timezone}.

Current tasks:
${describeTasks(tasks)}

You may return local task actions only when the user clearly asks for them or the action is the direct completion of their request.
- create_task: taskId must be null. Provide title, project, dueLabel, estimateMinutes.
- complete_task: use an exact existing taskId. Other fields must be null.
- reschedule_task: use an exact existing taskId and a human-readable dueLabel. Other fields must be null.
- Never delete tasks. Never invent task IDs. Maximum four actions.

Always include up to three short, useful follow-up suggestions.`;

  try {
    const response = await client.interactions.create({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
      input: messages.map((message) => ({
        role: message.role === "assistant" ? "model" : "user",
        content: message.content,
      })),
      system_instruction: instructions,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: ReplyJsonSchema,
      },
      generation_config: { max_output_tokens: 1200 },
    });

    if (!response.output_text) {
      return Response.json(
        { error: "Rhythm paused before answering. Try that once more." },
        { status: 502 },
      );
    }

    const reply = ReplySchema.parse(JSON.parse(response.output_text));
    return Response.json({
      message: reply.message,
      suggestions: reply.suggestions,
      actions: sanitizeActions(reply.actions, tasks),
    });
  } catch (error) {
    console.error("Rhythm chat error", error instanceof Error ? error.message : "Unknown error");
    return Response.json(
      { error: "Rhythm is taking a quiet moment. Please try again shortly." },
      { status: 502 },
    );
  }
}
