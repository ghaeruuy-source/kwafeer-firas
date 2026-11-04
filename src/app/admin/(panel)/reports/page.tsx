import Link from "next/link";
import { CalendarCheck2, Ban, UserPlus, UserX, Wallet, TrendingUp } from "lucide-react";
import { requireAdmin } from "@/lib/shop";
import { addDays, endOfMonth, isDateKey, startOfMonth, todayKey } from "@/lib/time";
import { formatDateKey, formatIQD } from "@/lib/format";
import { cn } from "@/lib/cn";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { Alert, EmptyState } from "@/components/ui/Feedback";

export const metadata = { title: "التقارير" };

interface Report {
  total: number; completed: number; cancelled: number; no_show: number; upcoming: number;
  revenue: number; expected: number; new_customers: number;
  by_day: { day: string; bookings: number; revenue: number }[];
  by_service: { name: string; bookings: number; revenue: number }[];
  by_barber: { name: string; bookings: number; revenue: number }[];
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const { supabase, shop } = await requireAdmin();
  const sp = await searchParams;
  const today = todayKey(shop.timezone);
  const presets = {
    month: { label: "هذا الشهر", from: startOfMonth(today), to: endOfMonth(today) },
    last_month: { label: "الشهر الماضي", from: startOfMonth(addDays(startOfMonth(today), -1)), to: addDays(startOfMonth(today), -1) },
    "7d": { label: "آخر 7 أيام", from: addDays(today, -6), to: today },
    "30d": { label: "آخر 30 يوم", from: addDays(today, -29), to: today },
  } as const;
  const key = (sp.range && sp.range in presets ? sp.range : isDateKey(sp.from) && isDateKey(sp.to) ? "custom" : "month") as keyof typeof presets | "custom";
  const range = key === "custom" ? { from: sp.from!, to: sp.to! } : presets[key];

  const { data, error } = await supabase.rpc("admin_report", { p_shop_id: shop.id, p_from: range.from, p_to: range.to });
  const r = data as Report | null;
  const maxDay = Math.max(1, ...(r?.by_day ?? []).map((d) => d.revenue));
  const attendance = r && r.completed + r.no_show > 0 ? Math.round((r.completed / (r.completed + r.no_show)) * 100) : null;

  return (
    <>
      <PageHeader title="التقارير" description={`${formatDateKey(range.from, { day: "numeric", month: "long" })} – ${formatDateKey(range.to, { day: "numeric", month: "long", year: "numeric" })}`} />
      <PageBody>
        <div className="flex flex-wrap items-center gap-2">
          {Object.entries(presets).map(([k, p]) => (
            <Link key={k} href={`/admin/reports?range=${k}`} className={cn("rounded-full border px-4 py-1.5 text-sm", key === k ? "border-gold bg-gold text-ink" : "border-line text-mute hover:text-bone")}>
              {p.label}
            </Link>
          ))}
          <form className="flex items-center gap-2 text-sm" action="/admin/reports">
            <input type="date" name="from" defaultValue={range.from} className="num h-9 rounded-lg border border-line bg-coal-2 px-2" />
            <span className="text-faint">–</span>
            <input type="date" name="to" defaultValue={range.to} className="num h-9 rounded-lg border border-line bg-coal-2 px-2" />
            <button className="h-9 rounded-lg border border-line px-3 text-mute hover:text-bone">عرض</button>
          </form>
        </div>

        {error && <Alert>تعذر تحميل التقرير: {error.message}</Alert>}
        {r && (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
              <StatCard label="الإيراد المحصّل" value={formatIQD(r.revenue)} icon={Wallet} accent hint="من الحجوزات المكتملة" />
              <StatCard label="الإيراد المتوقع" value={formatIQD(r.expected)} icon={TrendingUp} hint="مكتمل + قادم" />
              <StatCard label="كل الحجوزات" value={r.total} icon={CalendarCheck2} />
              <StatCard label="ملغية" value={r.cancelled} icon={Ban} />
              <StatCard label="غياب" value={r.no_show} icon={UserX} hint={attendance !== null ? `نسبة الحضور ${attendance}%` : undefined} />
              <StatCard label="زباين جدد" value={r.new_customers} icon={UserPlus} />
            </div>

            <Card>
              <CardHeader title="الإيراد اليومي" />
              {r.by_day.length === 0 ? (
                <EmptyState icon={Wallet} title="ما اكو بيانات بهذي الفترة" />
              ) : (
                <div className="no-scrollbar overflow-x-auto px-5 py-6">
                  <div className="flex h-48 min-w-max items-end gap-1.5">
                    {r.by_day.map((d) => (
                      <div key={d.day} className="group flex w-7 flex-col items-center gap-1.5" title={`${formatDateKey(d.day)}: ${formatIQD(d.revenue)} · ${d.bookings} حجز`}>
                        <span className="num text-[10px] text-faint opacity-0 transition group-hover:opacity-100">{Math.round(d.revenue / 1000)}k</span>
                        <div className="w-full rounded-t-md bg-gradient-to-t from-gold-deep to-gold transition group-hover:brightness-125" style={{ height: `${Math.max(2, (d.revenue / maxDay) * 150)}px` }} />
                        <span className="num text-[10px] text-faint">{Number(d.day.slice(8))}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <div className="grid gap-6 lg:grid-cols-2">
              <Breakdown title="حسب الخدمة" rows={r.by_service} />
              <Breakdown title="حسب الحلاق" rows={r.by_barber} />
            </div>
          </>
        )}
      </PageBody>
    </>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { name: string; bookings: number; revenue: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <Card>
      <CardHeader title={title} />
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-faint">ما اكو بيانات</p>
      ) : (
        <ul className="space-y-4 px-5 py-5">
          {rows.map((r) => (
            <li key={r.name}>
              <div className="flex items-center justify-between text-sm">
                <span>{r.name}</span>
                <span className="num text-mute">{formatIQD(r.revenue)} · {r.bookings} حجز</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-coal-3">
                <div className="h-full rounded-full bg-gold" style={{ width: `${(r.revenue / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
