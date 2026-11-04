"use client";

import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/Feedback";
import { formatDateKey, formatInstantTime, formatTime12 } from "@/lib/format";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/status";
import { addDays, toDateKey, toTimeKey, weekdayOf } from "@/lib/time";
import { useBoard } from "./BookingsBoard";
import type { Barber, BookingWithRelations, WorkingHours } from "@/lib/types";

const PX_PER_MIN = 1.4;
const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

const BLOCK_STYLE: Record<string, string> = {
  pending: "border-amber-400/50 bg-amber-400/10",
  confirmed: "border-emerald-400/50 bg-emerald-400/10",
  completed: "border-sky-400/40 bg-sky-400/10",
  cancelled: "border-zinc-600 bg-zinc-700/20 opacity-50",
  no_show: "border-rose-400/40 bg-rose-400/10 opacity-70",
};

export function DayView({ date, bookings, barbers, hours, tz }: { date: string; bookings: BookingWithRelations[]; barbers: Barber[]; hours: WorkingHours[]; tz: string }) {
  const { open, create } = useBoard();
  const wh = hours.find((h) => h.weekday === weekdayOf(date));
  const columns = barbers.filter((b) => b.is_active || bookings.some((x) => x.barber_id === b.id));

  const bookingMins = bookings.flatMap((b) => [toMin(toTimeKey(new Date(b.starts_at), tz)), toMin(toTimeKey(new Date(b.ends_at), tz)) || 1440]);
  const start = Math.floor(Math.min(wh?.is_open ? toMin(wh.open_time) : 600, ...bookingMins) / 60) * 60;
  const end = Math.ceil(Math.max(wh?.is_open ? toMin(wh.close_time) : 1320, ...bookingMins) / 60) * 60;
  const hoursList = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60);

  if (columns.length === 0) return <EmptyState icon={CalendarX2} title="ما اكو حلاقين" description="أضف حلاق من صفحة الحلاقين حته يطلع التقويم." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-line-soft bg-coal/70">
      {wh && !wh.is_open && <p className="border-b border-line-soft bg-coal-2/60 px-4 py-2 text-center text-xs text-mute">الصالون مسدود هذا اليوم حسب جدول الدوام</p>}
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex min-w-max lg:min-w-full">
          <div className="sticky right-0 z-10 w-16 shrink-0 border-l border-line-soft bg-coal">
            <div className="h-12 border-b border-line-soft" />
            {hoursList.map((m) => (
              <div key={m} style={{ height: 60 * PX_PER_MIN }} className="num relative border-b border-line-soft/50 pr-2 text-[11px] text-faint">
                <span className="absolute -top-2 right-2 bg-coal px-0.5">{formatTime12(`${String(m / 60).padStart(2, "0")}:00`)}</span>
              </div>
            ))}
          </div>
          {columns.map((barber) => {
            const list = bookings.filter((b) => b.barber_id === barber.id);
            return (
              <div key={barber.id} className="w-44 shrink-0 border-l border-line-soft last:border-l-0 sm:w-56 lg:min-w-56 lg:flex-1">
                <div className="flex h-12 items-center justify-center border-b border-line-soft px-2 text-sm font-medium">
                  {barber.name}
                  <span className="mr-2 rounded-full bg-coal-3 px-2 text-[11px] text-faint">{list.filter((b) => b.status !== "cancelled").length}</span>
                </div>
                <div className="relative" style={{ height: (end - start) * PX_PER_MIN }}>
                  {hoursList.map((m) => (
                    <div key={m} className="border-b border-line-soft/50" style={{ height: 60 * PX_PER_MIN }} />
                  ))}
                  {wh?.break_start && wh.break_end && (
                    <div
                      className="absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(255,255,255,0.03)_6px,rgba(255,255,255,0.03)_12px)] text-[11px] text-faint"
                      style={{ top: (toMin(wh.break_start) - start) * PX_PER_MIN, height: (toMin(wh.break_end) - toMin(wh.break_start)) * PX_PER_MIN }}
                    >
                      استراحة
                    </div>
                  )}
                  {list.map((b) => {
                    const s = toMin(toTimeKey(new Date(b.starts_at), tz));
                    const e = toMin(toTimeKey(new Date(b.ends_at), tz)) || 1440;
                    return (
                      <button
                        key={b.id}
                        onClick={() => open(b)}
                        title={STATUS_LABEL[b.status]}
                        className={cn("absolute inset-x-1.5 overflow-hidden rounded-lg border-r-[3px] px-2 py-1 text-right transition hover:brightness-125", BLOCK_STYLE[b.status])}
                        style={{ top: (s - start) * PX_PER_MIN + 1, height: Math.max((e - s) * PX_PER_MIN - 2, 26) }}
                      >
                        <p className="truncate text-xs font-medium">{b.customer?.name}</p>
                        <p className="num truncate text-[11px] text-mute">
                          {formatInstantTime(b.starts_at, tz)} · {b.service?.name}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex justify-center border-t border-line-soft p-3">
        <button onClick={() => create(date)} className="text-sm text-gold hover:text-gold-light">+ أضف حجز لهذا اليوم</button>
      </div>
    </div>
  );
}

export function WeekView({ from, bookings, tz, today }: { from: string; bookings: BookingWithRelations[]; tz: string; today: string }) {
  const { open } = useBoard();
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="grid gap-3 lg:grid-cols-7">
      {days.map((d) => {
        const list = bookings.filter((b) => toDateKey(new Date(b.starts_at), tz) === d);
        const isToday = d === today;
        return (
          <div key={d} className={cn("rounded-2xl border bg-coal/70", isToday ? "border-gold/40" : "border-line-soft")}>
            <Link href={`/admin/calendar?view=day&date=${d}`} className="flex items-center justify-between border-b border-line-soft px-3 py-2.5 hover:bg-coal-2/50">
              <span className={cn("text-sm", isToday ? "text-gold-light" : "text-bone")}>{formatDateKey(d, { weekday: "long" })}</span>
              <span className="num text-xs text-faint">{formatDateKey(d, { day: "numeric", month: "numeric" })}</span>
            </Link>
            <div className="space-y-1.5 p-2">
              {list.length === 0 && <p className="py-3 text-center text-xs text-faint">فارغ</p>}
              {list.map((b) => (
                <button key={b.id} onClick={() => open(b)} className={cn("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-right text-xs hover:bg-coal-3", (b.status === "cancelled" || b.status === "no_show") && "opacity-50")}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[b.status])} />
                  <span className="num shrink-0 text-mute">{formatInstantTime(b.starts_at, tz)}</span>
                  <span className="truncate">{b.customer?.name}</span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MonthView({ month, bookings, tz, today }: { month: string; bookings: BookingWithRelations[]; tz: string; today: string }) {
  const first = month;
  const offset = (weekdayOf(first) + 1) % 7; // Saturday-first grid
  const gridStart = addDays(first, -offset);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const monthKey = month.slice(0, 7);
  const byDay = new Map<string, BookingWithRelations[]>();
  for (const b of bookings) {
    const k = toDateKey(new Date(b.starts_at), tz);
    byDay.set(k, [...(byDay.get(k) ?? []), b]);
  }
  const heads = [6, 0, 1, 2, 3, 4, 5].map((d) => formatDateKey(addDays("2026-01-03", (d + 1) % 7), { weekday: "short" }));

  return (
    <div className="overflow-hidden rounded-2xl border border-line-soft bg-coal/70">
      <div className="grid grid-cols-7 border-b border-line-soft text-center text-[11px] text-faint">
        {heads.map((h) => (
          <div key={h} className="py-2">{h}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((d) => {
          const list = (byDay.get(d) ?? []).filter((b) => b.status !== "cancelled");
          const inMonth = d.startsWith(monthKey);
          return (
            <Link
              key={d}
              href={`/admin/calendar?view=day&date=${d}`}
              className={cn("min-h-16 border-b border-l border-line-soft/60 p-1.5 transition hover:bg-coal-2/60 sm:min-h-24 sm:p-2 [&:nth-child(7n)]:border-l-0", !inMonth && "opacity-35")}
            >
              <span className={cn("num inline-grid size-6 place-items-center rounded-full text-xs", d === today ? "bg-gold text-ink" : "text-mute")}>{Number(d.slice(8))}</span>
              {list.length > 0 && (
                <div className="mt-1">
                  <p className="text-[11px] text-bone sm:text-xs">
                    <span className="num">{list.length}</span> <span className="hidden sm:inline">حجز</span>
                  </p>
                  <div className="mt-1 flex flex-wrap gap-0.5">
                    {list.slice(0, 6).map((b) => (
                      <span key={b.id} className={cn("size-1.5 rounded-full", STATUS_DOT[b.status])} />
                    ))}
                  </div>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
