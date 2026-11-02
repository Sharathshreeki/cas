// Timestamps are stored in UTC (timestamptz). Everything shown to users and
// every calendar decision (slot days, "today" reports) uses campus local time,
// Asia/Kolkata (UTC+05:30, no DST) — NFR-45.

export const CAMPUS_TIME_ZONE = "Asia/Kolkata";
const OFFSET_MINUTES = 330;
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/** Calendar date (YYYY-MM-DD) in campus time for an instant. */
export function campusDateKey(at: Date = new Date()): string {
  return new Date(at.getTime() + OFFSET_MINUTES * MINUTE).toISOString().slice(0, 10);
}

/** UTC instant of campus midnight for a YYYY-MM-DD key. */
export function campusMidnight(dateKey: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Invalid date key");
  return new Date(Date.parse(`${dateKey}T00:00:00Z`) - OFFSET_MINUTES * MINUTE);
}

/** Minutes since campus midnight for an instant. */
export function campusMinuteOfDay(at: Date): number {
  const local = new Date(at.getTime() + OFFSET_MINUTES * MINUTE);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

export function addDays(dateKey: string, days: number): string {
  return campusDateKey(new Date(campusMidnight(dateKey).getTime() + days * DAY));
}

/** Range [start, end) covering a campus calendar day. */
export function campusDayRange(dateKey: string): { start: Date; end: Date } {
  const start = campusMidnight(dateKey);
  return { start, end: new Date(start.getTime() + DAY) };
}

/** 0 = Sunday … 6 = Saturday, in campus time. */
export function campusWeekday(dateKey: string): number {
  return new Date(`${dateKey}T00:00:00Z`).getUTCDay();
}

export function minutesToLabel(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function hhmmToMinutes(value: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Invalid time");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function minutesToHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const timeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: CAMPUS_TIME_ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: CAMPUS_TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dateTimeFormat = new Intl.DateTimeFormat("en-IN", {
  timeZone: CAMPUS_TIME_ZONE,
  day: "numeric",
  month: "short",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

export const formatTime = (at: Date | string) => timeFormat.format(new Date(at));
export const formatDate = (at: Date | string) => dateFormat.format(new Date(at));
export const formatDateTime = (at: Date | string) => dateTimeFormat.format(new Date(at));

export function formatSlot(startsAt: Date | string, endsAt: Date | string): string {
  return `${formatTime(startsAt)} – ${formatTime(endsAt)}`;
}

/** "Today", "Tomorrow" or a short date for a campus date key. */
export function relativeDayLabel(dateKey: string, now: Date = new Date()): string {
  const today = campusDateKey(now);
  if (dateKey === today) return "Today";
  if (dateKey === addDays(today, 1)) return "Tomorrow";
  return dateFormat.format(campusMidnight(dateKey));
}
