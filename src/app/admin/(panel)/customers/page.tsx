import Link from "next/link";
import { ChevronLeft, Gift, Users } from "lucide-react";
import { requireAdmin } from "@/lib/shop";
import { formatPhone, toLatinDigits } from "@/lib/format";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { FilterBar } from "@/components/admin/FilterBar";
import { Card } from "@/components/ui/Card";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Monogram } from "@/components/ui/icons";
import { loyaltyConfig, loyaltyProgress } from "@/lib/loyalty";

export const metadata = { title: "الزباين" };

interface CustomerRow {
  id: string;
  name: string;
  phone: string;
  notes: string | null;
  created_at: string;
  bookings: { status: string; starts_at: string }[];
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; reward?: string }> }) {
  const { supabase, shop } = await requireAdmin();
  const sp = await searchParams;
  const loyalty = loyaltyConfig(shop);
  const onlyReward = Boolean(loyalty && sp.reward);
  const q = sp.q ? toLatinDigits(sp.q).replace(/[%,()*]/g, "").trim().slice(0, 40) : "";

  let query = supabase.from("customers").select("id,name,phone,notes,created_at,bookings(status,starts_at)", { count: "exact" }).eq("shop_id", shop.id);
  if (q) {
    const digits = q.replace(/\D/g, "");
    const phoneTerm = digits.startsWith("0") ? digits.slice(1) : digits;
    query = query.or([`name.ilike.*${q}*`, phoneTerm.length >= 3 ? `phone.ilike.*${phoneTerm}*` : null].filter(Boolean).join(","));
  }
  const { data, error, count } = await query.order("created_at", { ascending: false }).limit(100);
  const all = (data ?? []) as CustomerRow[];
  const progressOf = (c: CustomerRow) => (loyalty ? loyaltyProgress(c.bookings.filter((b) => b.status === "completed").length, loyalty) : null);
  const readyCount = all.filter((c) => progressOf(c)?.ready).length;
  const customers = onlyReward ? all.filter((c) => progressOf(c)?.ready) : all;

  return (
    <>
      <PageHeader title="الزباين" description={`${count ?? 0} زبون`} />
      <PageBody>
        <FilterBar placeholder="ابحث بالاسم أو الرقم" />
        {loyalty && (readyCount > 0 || onlyReward) && (
          <Link
            href={onlyReward ? "/admin/customers" : "/admin/customers?reward=1"}
            className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/[0.08] px-4 py-3 text-sm transition hover:bg-gold/[0.12]"
          >
            <Gift className="size-5 shrink-0 text-gold" />
            <span className="flex-1">
              {onlyReward ? "تعرض بس الزباين المستحقين للمكافأة. اضغط حته ترجع لكل الزباين" : <><span className="num">{readyCount}</span> {readyCount === 1 ? "زبون مستحق" : "زباين مستحقين"} المكافأة ({loyalty.reward}). اضغط حته تشوفهم</>}
            </span>
          </Link>
        )}
        {error && <Alert>تعذر تحميل الزباين: {error.message}</Alert>}
        <Card>
          {customers.length === 0 ? (
            <EmptyState icon={Users} title={q ? "ما لكينا زبون بهذا الاسم أو الرقم" : "ما اكو زباين بعد"} description={q ? undefined : "أي زبون يحجز يتسجل هنا تلقائياً."} />
          ) : (
            <ul className="divide-y divide-line-soft">
              {customers.map((c) => {
                const done = c.bookings.filter((b) => b.status === "completed");
                const last = done.map((b) => b.starts_at).sort().at(-1);
                const noShows = c.bookings.filter((b) => b.status === "no_show").length;
                const lp = progressOf(c);
                return (
                  <li key={c.id}>
                    <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-4 px-4 py-3.5 transition hover:bg-coal-2/60 sm:px-5">
                      <Monogram name={c.name} className="size-10 shrink-0 text-base" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{c.name}</p>
                        <p className="num truncate text-right text-xs text-mute">{formatPhone(c.phone)}</p>
                      </div>
                      <div className="shrink-0 text-left text-xs">
                        <p className="text-bone"><span className="num">{done.length}</span> زيارة</p>
                        {lp?.ready ? (
                          <p className="inline-flex items-center gap-1 text-gold-light"><Gift className="size-3.5" /> مكافأة</p>
                        ) : lp && lp.stamps > 0 ? (
                          <p className="num text-gold/80">{lp.stamps}/{lp.every}</p>
                        ) : null}
                        {noShows > 0 ? <p className="text-rose-300"><span className="num">{noShows}</span> غياب</p> : last ? <p className="text-faint">آخر زيارة {new Date(last).toLocaleDateString("ar-IQ-u-nu-latn", { day: "numeric", month: "short", timeZone: shop.timezone })}</p> : null}
                      </div>
                      <ChevronLeft className="size-4 shrink-0 text-faint" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}
