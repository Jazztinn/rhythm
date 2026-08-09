import type { SlackMessage } from "./slack.ts";

export type SlackCommitment = {
  sourceMessageId: string;
  title: string;
  reason: string;
};

const requestSignal = /\b(?:can you|could you|would you|please|need you to|will you|action item|follow[- ]?up|by (?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)|deadline)\b/i;
const actionSignal = /\b(?:review|send|share|prepare|update|finish|check|confirm|schedule|draft|create|reply|follow|submit|complete)\b/i;

export function identifySlackCommitment(message: SlackMessage): SlackCommitment | null {
  const text = message.text.replace(/\s+/g, " ").trim();
  if (!text || !requestSignal.test(text) || !actionSignal.test(text)) return null;
  return {
    sourceMessageId: message.id,
    title: text.slice(0, 80),
    reason: "Message includes a request or deadline. Review before creating anything.",
  };
}
