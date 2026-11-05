import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireAdmin } from "@/lib/shop";
import { getBookingsInRange, getCatalog } from "@/lib/admin-data";
import { addDays, endOfMonth, isDateKey, startOfMonth, startOfWeek, toDateKey, todayKey } from "@/lib/time";
import { formatDateKey } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { BookingsBoard, NewBookingButton } from "@/components/admin/BookingsBoard";
import { DayStrip, DayView, MonthView, WeekView } from "@/components/admin/CalendarViews";
import type { WorkingHours } from "@/lib/types";

export const metadata = { title: "التقويم" };
type View = "day" | "week" | "month";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ view?: string; date?: string }> }) {
  const { supabase, shop } = await requireAdmin();
  const sp = await searchParams;
  const tz = shop.timezone;
  const today = todayKey(tz);
  const view: View = sp.view === "week" || sp.view === "month" ? sp.view : "day";
  const date = isDateKey(sp.date) ? sp.date : today;

  let from = date, to = date, prev = addDays(date, -1), next = addDays(date, 1), title = formatDateKey(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  if (view === "week") {
    from = startOfWeek(date);
    to = addDays(from, 6);
    prev = addDays(from, -7);
    next = addDays(from, 7);
    title = `${formatDateKey(from, { day: "numeric", month: "short" })} – ${formatDateKey(to, { day: "numeric", month: "short", year: "numeric" })}`;
  } else if (view === "month") {
    from = startOfMonth(date);
    to = endOfMonth(date);
    prev = startOfMonth(addDays(from, -1));
    next = addDays(to, 1);
    title = formatDateKey(from, { month: "long", year: "numeric" });
  }

  const [catalog, bookings, hoursRes] = await Promise.all([
    getCatalog(supabase, shop.id),
    // day view loads its whole week so the day strip can show per-day counts
    getBookingsInRange(
      supabase,
      shop.id,
      tz,
      view === "month" ? startOfWeek(from) : view === "day" ? startOfWeek(date) : from,
      view === "month" ? addDays(startOfWeek(to), 6) : view === "day" ? addDays(startOfWeek(date), 6) : to,
    ),
    supabase.from("working_hours").select("*").eq("shop_id", shop.id),
  ]);
  const hours = (hoursRes.data ?? []) as WorkingHours[];
  const href = (v: View, d: string) => `/admin/calendar?view=${v}&date=${d}`;
  const counts: Record<string, number> = {};
  for (const b of bookings) {
    if (b.status === "cancelled") continue;
    const k = toDateKey(new Date(b.starts_at), tz);
    counts[k] = (counts[k] ?? 0) + 1;
  }
  const dayBookings = view === "day" ? bookings.filter((b) => toDateKey(new Date(b.starts_at), tz) === date) : bookings;

  return (
    <BookingsBoard shop={shop} services={catalog.services} barbers={catalog.barbers}>
      <PageHeader title="التقويم" actions={<NewBookingButton date={view === "day" ? date : undefined} />} />
      <PageBody>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link href={href(view, prev)} aria-label="السابق" className="grid size-10 place-items-center rounded-xl border border-line bg-coal hover:border-gold/40">
              <ChevronRight className="size-5" />
            </Link>
            <Link href={href(view, next)} aria-label="التالي" className="grid size-10 place-items-center rounded-xl border border-line bg-coal hover:border-gold/40">
              <ChevronLeft className="size-5" />
            </Link>
            <Link href={href(view, today)} className="rounded-xl border border-line bg-coal px-3 py-2 text-sm hover:border-gold/40">
              اليوم
            </Link>
            <h2 className="mr-2 font-display text-base sm:text-lg">{title}</h2>
          </div>
          <div className="flex rounded-xl border border-line bg-coal p-1 text-sm">
            {(["day", "week", "month"] as View[]).map((v) => (
              <Link key={v} href={href(v, date)} className={cn("rounded-lg px-4 py-1.5 transition", v === view ? "bg-gold text-ink" : "text-mute hover:text-bone")}>
                {v === "day" ? "يوم" : v === "week" ? "أسبوع" : "شهر"}
              </Link>
            ))}
          </div>
        </div>

        {view === "day" && <DayStrip date={date} today={today} counts={counts} />}
        {view === "day" && <DayView date={date} bookings={dayBookings} barbers={catalog.barbers} hours={hours} tz={tz} nowMs={Date.now()} slotMinutes={shop.slot_interval_minutes || 15} />}
        {view === "week" && <WeekView from={from} bookings={bookings} tz={tz} today={today} />}
        {view === "month" && <MonthView month={from} bookings={bookings} tz={tz} today={today} />}
      </PageBody>
    </BookingsBoard>
  );
}
