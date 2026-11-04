import Link from "next/link";
import { ArrowLeft, CalendarCheck2, CalendarClock, Hourglass, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/shop";
import { getBookingsInRange, getCatalog } from "@/lib/admin-data";
import { BOOKING_SELECT, type BookingWithRelations } from "@/lib/types";
import { formatDateKey, formatIQD } from "@/lib/format";
import { endOfMonth, startOfMonth, todayKey, zonedToUtc } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { BookingsBoard, NewBookingButton } from "@/components/admin/BookingsBoard";
import { BookingList } from "@/components/admin/BookingList";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";

export const metadata = { title: "الرئيسية" };

export default async function AdminHome() {
  const { supabase, shop } = await requireAdmin();
  const tz = shop.timezone;
  const today = todayKey(tz);
  const nowIso = new Date().toISOString();

  const [catalog, todays, upcoming, pendingCount, monthCount] = await Promise.all([
    getCatalog(supabase, shop.id),
    getBookingsInRange(supabase, shop.id, tz, today, today),
    supabase
      .from("bookings")
      .select(BOOKING_SELECT)
      .eq("shop_id", shop.id)
      .in("status", ["pending", "confirmed"])
      .gte("starts_at", zonedToUtc(today, "00:00", tz).toISOString())
      .gt("starts_at", nowIso)
      .order("starts_at")
      .limit(8),
    supabase.from("bookings").select("id", { count: "exact", head: true }).eq("shop_id", shop.id).eq("status", "pending").gt("starts_at", nowIso),
    supabase
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shop.id)
      .neq("status", "cancelled")
      .gte("starts_at", zonedToUtc(startOfMonth(today), "00:00", tz).toISOString())
      .lte("starts_at", zonedToUtc(endOfMonth(today), "23:59", tz).toISOString()),
  ]);

  const liveToday = todays.filter((b) => b.status !== "cancelled" && b.status !== "no_show");
  const expectedToday = liveToday.reduce((s, b) => s + b.price_iqd, 0);
  const upcomingList = (upcoming.data ?? []) as BookingWithRelations[];
  const needsSetup = catalog.services.length === 0 || catalog.barbers.length === 0;

  return (
    <BookingsBoard shop={shop} services={catalog.services} barbers={catalog.barbers}>
      <PageHeader title="أهلاً بيك" description={formatDateKey(today, { weekday: "long", day: "numeric", month: "long", year: "numeric" })} actions={<NewBookingButton date={today} />} />
      <PageBody>
        {needsSetup && (
          <Alert tone="info">
            حته يشتغل الحجز أونلاين، أضف{" "}
            <Link href="/admin/services" className="underline">الخدمات</Link> و<Link href="/admin/barbers" className="underline">الحلاقين</Link>، وراجع{" "}
            <Link href="/admin/hours" className="underline">أوقات الدوام</Link>.
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="حجوزات اليوم" value={liveToday.length} icon={CalendarCheck2} accent />
          <StatCard label="بانتظار التأكيد" value={pendingCount.count ?? 0} icon={Hourglass} hint="حجوزات قادمة تحتاج رد" />
          <StatCard label="حجوزات هذا الشهر" value={monthCount.count ?? 0} icon={CalendarClock} />
          <StatCard label="المتوقع اليوم" value={formatIQD(expectedToday)} icon={Wallet} />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader
              title="مواعيد اليوم"
              description={`${liveToday.length} موعد`}
              action={
                <Link href="/admin/calendar" className="flex items-center gap-1 text-xs text-gold hover:text-gold-light">
                  التقويم <ArrowLeft className="size-3.5" />
                </Link>
              }
            />
            <BookingList bookings={todays} tz={tz} emptyTitle="ما اكو مواعيد اليوم" emptyDescription="الحجوزات الجديدة راح تطلع هنا أول بأول." />
          </Card>
          <Card>
            <CardHeader
              title="الجاية"
              action={
                <Link href="/admin/bookings" className="flex items-center gap-1 text-xs text-gold hover:text-gold-light">
                  كل الحجوزات <ArrowLeft className="size-3.5" />
                </Link>
              }
            />
            <BookingList bookings={upcomingList} tz={tz} showDate emptyTitle="ما اكو حجوزات قادمة" />
          </Card>
        </div>
      </PageBody>
    </BookingsBoard>
  );
}
