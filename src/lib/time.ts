/**
 * Time helpers. The shop's wall clock is always Asia/Baghdad (configurable per shop);
 * we never rely on the server's or the browser's local timezone.
 */
export const SHOP_TZ = "Asia/Baghdad";

export const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Parts of an instant as seen on the shop's wall clock. */
export function zonedParts(date: Date, tz = SHOP_TZ) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayIndex = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: Number(get("minute")),
    second: Number(get("second")),
    weekday: weekdayIndex,
  };
}

/** "YYYY-MM-DD" of an instant in the shop timezone. */
export function toDateKey(date: Date, tz = SHOP_TZ): string {
  const p = zonedParts(date, tz);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** "HH:MM" of an instant in the shop timezone. */
export function toTimeKey(date: Date, tz = SHOP_TZ): string {
  const p = zonedParts(date, tz);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function todayKey(tz = SHOP_TZ): string {
  return toDateKey(new Date(), tz);
}

/** Converts a shop-local date + time ("2026-11-05", "14:30") to a UTC Date. */
export function zonedToUtc(dateKey: string, time: string, tz = SHOP_TZ): Date {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  // offset = wall clock at guess - guess; iterate twice to settle around DST edges
  let ts = guess;
  for (let i = 0; i < 2; i++) {
    const p = zonedParts(new Date(ts), tz);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    ts = guess - (asUtc - ts);
  }
  return new Date(ts);
}

/** Adds days to a "YYYY-MM-DD" key (calendar arithmetic, timezone-free). */
export function addDays(dateKey: string, days: number): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function startOfWeek(dateKey: string): string {
  // Iraqi week starts on Saturday
  const wd = weekdayOf(dateKey);
  return addDays(dateKey, -((wd + 1) % 7));
}

export function startOfMonth(dateKey: string): string {
  return `${dateKey.slice(0, 7)}-01`;
}

export function endOfMonth(dateKey: string): string {
  const [y, m] = dateKey.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return `${dateKey.slice(0, 7)}-${pad(last)}`;
}

export function isDateKey(v: unknown): v is string {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}

/** "10:00:00" -> "10:00" */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : "");
