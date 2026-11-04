import { formatTime12 } from "./format";
import { hhmm, zonedParts } from "./time";
import type { WorkingHours } from "./types";

export function openStatus(hours: WorkingHours[], tz: string) {
  const now = zonedParts(new Date(), tz);
  const today = hours.find((h) => h.weekday === now.weekday);
  const minutes = now.hour * 60 + now.minute;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  if (!today || !today.is_open) return { open: false, label: "مسدود اليوم" };
  const o = toMin(today.open_time), c = toMin(today.close_time);
  if (minutes < o) return { open: false, label: `يفتح ${formatTime12(hhmm(today.open_time))}` };
  if (minutes >= c) return { open: false, label: "مسدود هسه" };
  if (today.break_start && today.break_end && minutes >= toMin(today.break_start) && minutes < toMin(today.break_end)) {
    return { open: false, label: `استراحة لحد ${formatTime12(hhmm(today.break_end))}` };
  }
  return { open: true, label: `مفتوح هسه · يسد ${formatTime12(hhmm(today.close_time))}` };
}
