"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/Feedback";
import { formatDateKey, formatInstantTime, formatTime12 } from "@/lib/format";
import { STATUS_DOT, STATUS_LABEL } from "@/lib/status";
import { addDays, startOfWeek, toDateKey, toTimeKey, weekdayOf } from "@/lib/time";
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

export function DayView({
  date,
  bookings,
  barbers,
  hours,
  tz,
  nowMs,
  slotMinutes = 15,
}: {
  date: string;
  bookings: BookingWithRelations[];
  barbers: Barber[];
  hours: WorkingHours[];
  tz: string;
  nowMs: number;
  slotMinutes?: number;
}) {
  const { open, create } = useBoard();
  const [now, setNow] = useState(nowMs);
  const [hover, setHover] = useState<{ barber: string; min: number } | null>(null);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  const wh = hours.find((h) => h.weekday === weekdayOf(date));
  const columns = barbers.filter((b) => b.is_active || bookings.some((x) => x.barber_id === b.id));

  const bookingMins = bookings.flatMap((b) => [toMin(toTimeKey(new Date(b.starts_at), tz)), toMin(toTimeKey(new Date(b.ends_at), tz)) || 1440]);
  const start = Math.floor(Math.min(wh?.is_open ? toMin(wh.open_time) : 600, ...bookingMins) / 60) * 60;
  const end = Math.ceil(Math.max(wh?.is_open ? toMin(wh.close_time) : 1320, ...bookingMins) / 60) * 60;
  const hoursList = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60);

  const isToday = toDateKey(new Date(now), tz) === date;
  const nowMin = toMin(toTimeKey(new Date(now), tz));
  const showNow = isToday && nowMin >= start && nowMin <= end;
  const openFrom = wh?.is_open ? toMin(wh.open_time) : null;
  const openTo = wh?.is_open ? toMin(wh.close_time) : null;

  const slotAt = (e: React.MouseEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top;
    return start + Math.floor(y / PX_PER_MIN / slotMinutes) * slotMinutes;
  };
  const hhmmOf = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  if (columns.length === 0) return <EmptyState icon={CalendarX2} title="ما اكو حلاقين" description="أضف حلاق من صفحة الحلاقين حته يطلع التقويم." />;

  return (
    <div className="overflow-hidden rounded-2xl border border-line-soft bg-coal/70">
      {wh && !wh.is_open && <p className="border-b border-line-soft bg-coal-2/60 px-4 py-2 text-center text-xs text-mute">الصالون مسدود هذا اليوم حسب جدول الدوام</p>}
      <div className="no-scrollbar overflow-x-auto">
        <div className="flex min-w-max lg:min-w-full">
          <div className="sticky right-0 z-20 w-16 shrink-0 border-l border-line-soft bg-coal">
            <div className="h-14 border-b border-line-soft" />
            <div className="relative">
              {hoursList.map((m) => (
                <div key={m} style={{ height: 60 * PX_PER_MIN }} className="num relative border-b border-line-soft/50 pr-2 text-[11px] text-faint">
                  <span className="absolute -top-2 right-2 bg-coal px-0.5">{formatTime12(`${String(m / 60).padStart(2, "0")}:00`)}</span>
                </div>
              ))}
              {showNow && (
                <span className="num absolute right-1 z-10 -translate-y-1/2 rounded-full bg-gold px-1.5 text-[10px] font-semibold leading-4 text-ink" style={{ top: (nowMin - start) * PX_PER_MIN }}>
                  {formatTime12(hhmmOf(nowMin)).replace(/ [صم]$/, "")}
                </span>
              )}
            </div>
          </div>
          {columns.map((barber) => {
            const list = bookings.filter((b) => b.barber_id === barber.id);
            const live = list.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
            return (
              <div key={barber.id} className="w-44 shrink-0 border-l border-line-soft last:border-l-0 sm:w-56 lg:min-w-56 lg:flex-1">
                <div className="sticky top-0 flex h-14 items-center gap-2.5 border-b border-line-soft px-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gold/15 font-display text-sm text-gold-light ring-1 ring-gold/30">{barber.name.trim().charAt(0)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{barber.name}</p>
                    <p className="num text-[11px] text-faint">{live.length} موعد</p>
                  </div>
                </div>
                <div
                  className="relative cursor-copy"
                  style={{ height: (end - start) * PX_PER_MIN }}
                  onMouseMove={(e) => setHover({ barber: barber.id, min: slotAt(e) })}
                  onMouseLeave={() => setHover(null)}
                  onClick={(e) => create(date, { time: hhmmOf(slotAt(e)), barberId: barber.id })}
                  title="اضغط على أي وقت فارغ حته تضيف حجز"
                >
                  {hoursList.map((m) => (
                    <div key={m} className="border-b border-line-soft/50" style={{ height: 60 * PX_PER_MIN }}>
                      <div className="border-b border-dashed border-line-soft/30" style={{ height: 30 * PX_PER_MIN }} />
                    </div>
                  ))}
                  {/* shade outside working hours */}
                  {openFrom !== null && openFrom > start && <div className="pointer-events-none absolute inset-x-0 top-0 bg-ink/40" style={{ height: (openFrom - start) * PX_PER_MIN }} />}
                  {openTo !== null && openTo < end && <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-ink/40" style={{ height: (end - openTo) * PX_PER_MIN }} />}
                  {wh?.break_start && wh.break_end && (
                    <div
                      className="pointer-events-none absolute inset-x-0 flex items-center justify-center bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(255,255,255,0.03)_6px,rgba(255,255,255,0.03)_12px)] text-[11px] text-faint"
                      style={{ top: (toMin(wh.break_start) - start) * PX_PER_MIN, height: (toMin(wh.break_end) - toMin(wh.break_start)) * PX_PER_MIN }}
                    >
                      استراحة
                    </div>
                  )}
                  {hover?.barber === barber.id && (
                    <div
                      className="pointer-events-none absolute inset-x-1.5 flex items-center rounded-lg border border-dashed border-gold/50 bg-gold/5 px-2 text-[11px] text-gold-light"
                      style={{ top: (hover.min - start) * PX_PER_MIN, height: slotMinutes * PX_PER_MIN }}
                    >
                      <span className="num">+ {formatTime12(hhmmOf(hover.min))}</span>
                    </div>
                  )}
                  {list.map((b) => {
                    const s = toMin(toTimeKey(new Date(b.starts_at), tz));
                    const e = toMin(toTimeKey(new Date(b.ends_at), tz)) || 1440;
                    const h = (e - s) * PX_PER_MIN;
                    return (
                      <button
                        key={b.id}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          open(b);
                        }}
                        onMouseMove={(ev) => ev.stopPropagation()}
                        onMouseEnter={() => setHover(null)}
                        title={`${b.customer?.name ?? ""} · ${STATUS_LABEL[b.status]}`}
                        className={cn("absolute inset-x-1.5 z-[1] cursor-pointer overflow-hidden rounded-lg border-r-[3px] px-2 py-1 text-right shadow-sm transition hover:brightness-125", BLOCK_STYLE[b.status])}
                        style={{ top: (s - start) * PX_PER_MIN + 1, height: Math.max(h - 2, 26) }}
                      >
                        <p className="truncate text-xs font-medium">{b.customer?.name}</p>
                        <p className="num truncate text-[11px] text-mute">
                          {formatInstantTime(b.starts_at, tz)} · {b.service?.name}
                        </p>
                        {h > 60 && <p className="mt-0.5 truncate text-[11px] text-faint">{STATUS_LABEL[b.status]}</p>}
                      </button>
                    );
                  })}
                  {showNow && (
                    <div className="pointer-events-none absolute inset-x-0 z-[2] h-0.5 bg-gold shadow-[0_0_8px_rgba(200,155,90,0.7)]" style={{ top: (nowMin - start) * PX_PER_MIN }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-4 py-3">
        <StatusLegend />
        <button onClick={() => create(date)} className="text-sm text-gold hover:text-gold-light">+ أضف حجز لهذا اليوم</button>
      </div>
    </div>
  );
}

export function StatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-faint">
      {(Object.keys(STATUS_LABEL) as (keyof typeof STATUS_LABEL)[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", STATUS_DOT[s])} />
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}

/** Seven-day chip strip above the day view for one-tap day switching (Booksy/Fresha style). */
export function DayStrip({ date, today, counts }: { date: string; today: string; counts: Record<string, number> }) {
  const from = startOfWeek(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i));
  return (
    <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {days.map((d) => {
        const active = d === date;
        return (
          <Link
            key={d}
            href={`/admin/calendar?view=day&date=${d}`}
            className={cn(
              "flex min-w-14 flex-1 flex-col items-center gap-0.5 rounded-2xl border px-2 py-2 transition",
              active ? "border-gold bg-gold text-ink" : d === today ? "border-gold/40 bg-coal text-gold-light" : "border-line-soft bg-coal text-mute hover:border-gold/30",
            )}
          >
            <span className="text-[11px]">{formatDateKey(d, { weekday: "short" })}</span>
            <span className="num font-display text-lg leading-tight">{Number(d.slice(8))}</span>
            <span className={cn("num text-[10px]", active ? "text-ink/70" : "text-faint")}>{counts[d] ? `${counts[d]} حجز` : "—"}</span>
          </Link>
        );
      })}
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
