import Link from "next/link";
import { ArrowLeft, CalendarClock, CalendarDays, Gauge, Hourglass, Users } from "lucide-react";
import { requireAdmin } from "@/lib/shop";
import { getBookingsInRange, getCatalog } from "@/lib/admin-data";
import { BOOKING_SELECT, type BookingWithRelations, type WorkingHours } from "@/lib/types";
import { formatDateKey, formatTime12 } from "@/lib/format";
import { addDays, endOfMonth, startOfMonth, todayKey, weekdayOf, zonedParts, zonedToUtc } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { BookingsBoard, NewBookingButton } from "@/components/admin/BookingsBoard";
import { BookingList } from "@/components/admin/BookingList";
import { DayProgress, NextUpCard, RequestsInbox, TeamToday, TodayAgenda } from "@/components/admin/Dashboard";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";

export const metadata = { title: "اليوم" };

const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

export default async function AdminHome({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { supabase, shop } = await requireAdmin();
  const sp = await searchParams;
  const tz = shop.timezone;
  const today = todayKey(tz);
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const [catalog, todays, upcoming, pending, monthCount, hoursRes] = await Promise.all([
    getCatalog(supabase, shop.id),
    getBookingsInRange(supabase, shop.id, tz, today, today),
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("shop_id", shop.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", zonedToUtc(addDays(today, 1), "00:00", tz).toISOString())
      .order("starts_at")
      .limit(6),
    supabase.from("bookings").select(BOOKING_SELECT, { count: "exact" }).eq("shop_id", shop.id).eq("status", "pending").gt("starts_at", nowIso).order("starts_at").limit(5),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .neq("status", "cancelled")
      .gte("starts_at", zonedToUtc(startOfMonth(today), "00:00", tz).toISOString())
      .lte("starts_at", zonedToUtc(endOfMonth(today), "23:59", tz).toISOString()),
    supabase.from("working_hours").select("*").eq("shop_id", shop.id).eq("weekday", weekdayOf(today)).maybeSingle(),
  ]);

  const counted = todays.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
  const expected = counted.reduce((s, b) => s + b.price_iqd, 0);
  const completed = counted.filter((b) => b.status === "completed");
  const earned = completed.reduce((s, b) => s + b.price_iqd, 0);
  const pendingList = (pending.data ?? []) as BookingWithRelations[];
  const upcomingList = (upcoming.data ?? []) as BookingWithRelations[];
  const needsSetup = catalog.services.length === 0 || catalog.barbers.length === 0;

  // Occupancy = booked chair-minutes / open chair-minutes (Fresha/Square style utilisation)
  const wh = hoursRes.data as WorkingHours | null;
  const openMinutes = wh?.is_open
    ? toMin(wh.close_time) - toMin(wh.open_time) - (wh.break_start && wh.break_end ? toMin(wh.break_end) - toMin(wh.break_start) : 0)
    : 0;
  const activeBarbers = catalog.barbers.filter((b) => b.is_active).length;
  const bookedMinutes = counted.reduce((s, b) => s + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000, 0);
  const occupancy = openMinutes > 0 && activeBarbers > 0 ? Math.min(100, Math.round((bookedMinutes / (openMinutes * activeBarbers)) * 100)) : 0;

  const hour = zonedParts(new Date(nowMs), tz).hour;
  const greeting = hour < 12 ? "صباح الخير" : "مساء الخير";

  return (
    <BookingsBoard shop={shop} services={catalog.services} barbers={catalog.barbers} autoCreate={sp.new === "1"}>
      <PageHeader
        title={greeting}
        description={
          <>
            {formatDateKey(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            {wh && (wh.is_open ? <span className="num"> · دوام اليوم من {formatTime12(wh.open_time.slice(0, 5))} لـ {formatTime12(wh.close_time.slice(0, 5))}</span> : " · اليوم عطلة")}
          </>
        }
        actions={
          <>
            <ButtonLink href="/admin/calendar" variant="outline" size="sm">
              <CalendarDays className="size-4" /> التقويم
            </ButtonLink>
            <NewBookingButton date={today} />
          </>
        }
      />
      <PageBody>
        {needsSetup && (
          <Alert tone="info">
            حته يشتغل الحجز أونلاين، أضف{" "}
            <Link href="/admin/services" className="underline">الخدمات</Link> و<Link href="/admin/barbers" className="underline">الحلاقين</Link>، وراجع{" "}
            <Link href="/admin/hours" className="underline">أوقات الدوام</Link>.
          </Alert>
        )}

        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <NextUpCard bookings={todays} tz={tz} shopName={shop.name} nowMs={nowMs} />
          <DayProgress earned={earned} expected={expected} done={completed.length} total={counted.length} occupancy={occupancy} />
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="مواعيد اليوم" value={counted.length} icon={Users} accent />
          <StatCard label="بانتظار التأكيد" value={pending.count ?? 0} icon={Hourglass} hint="تحتاج رد" />
          <StatCard label="إشغال الكراسي" value={`${occupancy}%`} icon={Gauge} hint={activeBarbers ? `${activeBarbers} حلاق اليوم` : undefined} />
          <StatCard label="حجوزات الشهر" value={monthCount.count ?? 0} icon={CalendarClock} />
        </div>

        <RequestsInbox bookings={pendingList} tz={tz} total={pending.count ?? pendingList.length} />

        <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card>
            <CardHeader
              title="جدول اليوم"
              description={`${counted.length} موعد`}
              action={
                <Link href="/admin/calendar" className="flex items-center gap-1 text-xs text-gold hover:text-gold-light">
                  عرض التقويم <ArrowLeft className="size-3.5" />
                </Link>
              }
            />
            <TodayAgenda bookings={todays} tz={tz} nowMs={nowMs} />
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader title="الفريق اليوم" />
              <TeamToday barbers={catalog.barbers} bookings={todays} tz={tz} nowMs={nowMs} openMinutes={openMinutes} />
            </Card>
            <Card>
              <CardHeader
                title="الأيام الجاية"
                action={
                  <Link href="/admin/bookings" className="flex items-center gap-1 text-xs text-gold hover:text-gold-light">
                    كل الحجوزات <ArrowLeft className="size-3.5" />
                  </Link>
                }
              />
              <BookingList bookings={upcomingList} tz={tz} showDate emptyTitle="ما اكو حجوزات قادمة" />
            </Card>
          </div>
        </div>
      </PageBody>
    </BookingsBoard>
  );
}
