import Link from "next/link";
import { requireAdmin } from "@/lib/shop";
import { getCatalog } from "@/lib/admin-data";
import { BOOKING_SELECT, type BookingWithRelations } from "@/lib/types";
import { ALL_STATUSES, STATUS_LABEL } from "@/lib/status";
import { toLatinDigits } from "@/lib/format";
import { todayKey, zonedToUtc } from "@/lib/time";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { BookingsBoard, NewBookingButton } from "@/components/admin/BookingsBoard";
import { BookingList } from "@/components/admin/BookingList";
import { FilterBar } from "@/components/admin/FilterBar";
import { Card } from "@/components/ui/Card";
import { Alert } from "@/components/ui/Feedback";

export const metadata = { title: "الحجوزات" };
const PAGE_SIZE = 40;

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; when?: string; page?: string }> }) {
  const { supabase, shop } = await requireAdmin();
  const sp = await searchParams;
  const tz = shop.timezone;
  const page = Math.max(1, Number(sp.page) || 1);
  const when = sp.when === "past" ? "past" : sp.when === "all" ? "all" : "upcoming";
  const status = ALL_STATUSES.find((s) => s === sp.status);
  const q = sp.q ? toLatinDigits(sp.q).replace(/[%,()*]/g, "").trim().slice(0, 40) : "";

  // !inner lets us filter bookings by the joined customer's name/phone
  let query = supabase
    .from("bookings")
    .select(q ? BOOKING_SELECT.replace("customer:customers(", "customer:customers!inner(") : BOOKING_SELECT, { count: "exact" })
    .eq("shop_id", shop.id);

  if (q) {
    const digits = q.replace(/\D/g, "");
    const phoneTerm = digits.startsWith("0") ? digits.slice(1) : digits;
    query = query.or(
      [`name.ilike.*${q}*`, phoneTerm.length >= 3 ? `phone.ilike.*${phoneTerm}*` : null].filter(Boolean).join(","),
      { referencedTable: "customers" },
    );
  }
  if (status) query = query.eq("status", status);
  const startToday = zonedToUtc(todayKey(tz), "00:00", tz).toISOString();
  if (when === "upcoming") query = query.gte("starts_at", startToday).order("starts_at", { ascending: true });
  else if (when === "past") query = query.lt("starts_at", startToday).order("starts_at", { ascending: false });
  else query = query.order("starts_at", { ascending: false });

  const [catalog, res] = await Promise.all([getCatalog(supabase, shop.id), query.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)]);
  const bookings = (res.data ?? []) as unknown as BookingWithRelations[];
  const total = res.count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const link = (p: Record<string, string | undefined>) => {
    const u = new URLSearchParams();
    const merged = { q: sp.q, status: sp.status, when: sp.when, page: sp.page, ...p };
    Object.entries(merged).forEach(([k, v]) => v && u.set(k, v));
    return `/admin/bookings?${u}`;
  };

  return (
    <BookingsBoard shop={shop} services={catalog.services} barbers={catalog.barbers}>
      <PageHeader title="الحجوزات" description={`${total} حجز`} actions={<NewBookingButton />} />
      <PageBody>
        <FilterBar placeholder="ابحث باسم الزبون أو رقمه" chips={ALL_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} />
        <div className="flex gap-1 rounded-xl border border-line bg-coal p-1 text-sm sm:w-fit">
          {[
            { v: "upcoming", l: "القادمة" },
            { v: "past", l: "السابقة" },
            { v: "all", l: "الكل" },
          ].map((o) => (
            <Link key={o.v} href={link({ when: o.v === "upcoming" ? undefined : o.v, page: undefined })} className={`flex-1 rounded-lg px-4 py-1.5 text-center ${when === o.v ? "bg-gold text-ink" : "text-mute hover:text-bone"}`}>
              {o.l}
            </Link>
          ))}
        </div>
        {res.error && <Alert>تعذر تحميل الحجوزات: {res.error.message}</Alert>}
        <Card>
          <BookingList bookings={bookings} tz={tz} showDate emptyTitle={q ? "ما لكينا نتائج" : "ما اكو حجوزات"} emptyDescription={q ? "جرب اسم أو رقم ثاني." : undefined} />
        </Card>
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 text-sm">
            {page > 1 && <Link href={link({ page: String(page - 1) })} className="rounded-xl border border-line px-4 py-2 hover:border-gold/40">السابق</Link>}
            <span className="num text-mute">{page} / {pages}</span>
            {page < pages && <Link href={link({ page: String(page + 1) })} className="rounded-xl border border-line px-4 py-2 hover:border-gold/40">التالي</Link>}
          </div>
        )}
      </PageBody>
    </BookingsBoard>
  );
}
