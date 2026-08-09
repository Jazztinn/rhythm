export type ConfirmedRoutineContext = {
  status: "confirmed" | "contextual" | "still_learning";
  category: string;
  windowStart: string;
  windowEnd: string;
};

export type NotificationContext = {
  now: Date;
  quietHours?: { start: string; end: string };
  confirmedPatterns: ConfirmedRoutineContext[];
  openItem?: { title: string; category: string; urgent: boolean };
  nextCommitment?: { title: string; startsAt: Date; preparationOpen?: boolean };
  allowReassurance?: boolean;
};

export type ContextualNotification = { kind: "reminder" | "preparation" | "reassurance"; message: string; reason: string };

function minutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function isQuietTime(now: Date, quietHours?: NotificationContext["quietHours"]) {
  if (!quietHours) return false;
  const start = minutes(quietHours.start);
  const end = minutes(quietHours.end);
  if (start === null || end === null || start === end) return false;
  const current = now.getHours() * 60 + now.getMinutes();
  return start < end ? current >= start && current < end : current >= start || current < end;
}

export function buildContextualNotification(context: NotificationContext): ContextualNotification | null {
  if (isQuietTime(context.now, context.quietHours)) return null;
  const commitment = context.nextCommitment;
  if (commitment?.preparationOpen) {
    const minutesUntil = Math.round((commitment.startsAt.getTime() - context.now.getTime()) / 60_000);
    if (minutesUntil > 0 && minutesUntil <= 60) return { kind: "preparation", message: `${commitment.title} starts in about ${minutesUntil} minutes, and preparation is still open.`, reason: "Confirmed Calendar timing and an unfinished preparation task." };
  }
  const item = context.openItem;
  const confirmed = item ? context.confirmedPatterns.find((pattern) => pattern.status === "confirmed" && pattern.category === item.category) : undefined;
  if (item && confirmed) {
    const current = context.now.getHours() * 60 + context.now.getMinutes();
    const start = minutes(confirmed.windowStart);
    const end = minutes(confirmed.windowEnd);
    if (start !== null && end !== null && current >= start && current <= end) return { kind: "reminder", message: `This is your confirmed window for ${item.category}. “${item.title}” is still open.`, reason: "Uses a routine window you confirmed." };
  }
  if (context.allowReassurance && !item?.urgent) return { kind: "reassurance", message: "Nothing urgent needs your attention right now.", reason: "No urgent open item in the provided task context." };
  return null;
}
