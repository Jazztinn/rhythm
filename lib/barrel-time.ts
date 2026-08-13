export type TimeParts = { hour: number; minute: number; period: "AM" | "PM" };

export function parseBarrelTime(value: string): TimeParts {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  const rawHour = match ? Number(match[1]) : 9;
  const rawMinute = match ? Number(match[2]) : 0;
  const hour24 = Number.isFinite(rawHour) ? Math.max(0, Math.min(23, rawHour)) : 9;
  const minute = Number.isFinite(rawMinute) ? Math.round(rawMinute / 5) * 5 % 60 : 0;
  return { hour: hour24 % 12 || 12, minute, period: hour24 >= 12 ? "PM" : "AM" };
}

export function formatBarrelTime(hour: number, minute: number, period: "AM" | "PM") {
  const hour24 = period === "PM" ? (hour % 12) + 12 : hour % 12;
  return `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

export function replaceLocalDate(value: string, date: string) {
  return `${date}T${value.slice(11, 16) || "09:00"}`;
}

export function replaceLocalTime(value: string, time: string) {
  return `${value.slice(0, 10)}T${time}`;
}
