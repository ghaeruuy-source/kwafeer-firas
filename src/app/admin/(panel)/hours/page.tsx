import { requireAdmin } from "@/lib/shop";
import { getCatalog } from "@/lib/admin-data";
import type { BlockedTime, WorkingHours } from "@/lib/types";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { HoursEditor } from "@/components/admin/HoursEditor";
import { BlockedTimesManager } from "@/components/admin/BlockedTimesManager";

export const metadata = { title: "الدوام والعطل" };

export default async function HoursPage() {
  const { supabase, shop } = await requireAdmin();
  const [hours, blocked, catalog] = await Promise.all([
    supabase.from("working_hours").select("*").eq("shop_id", shop.id).order("weekday"),
    supabase.from("blocked_times").select("*").eq("shop_id", shop.id).gte("ends_at", new Date().toISOString()).order("starts_at"),
    getCatalog(supabase, shop.id),
  ]);
  return (
    <>
      <PageHeader title="الدوام والعطل" description="بتوقيت بغداد" />
      <PageBody>
        <section className="space-y-3">
          <h2 className="font-display text-lg">الدوام الأسبوعي</h2>
          <HoursEditor hours={(hours.data ?? []) as WorkingHours[]} />
        </section>
        <section className="space-y-3 pt-6">
          <h2 className="font-display text-lg">العطل والأوقات المسكّرة</h2>
          <BlockedTimesManager items={(blocked.data ?? []) as BlockedTime[]} barbers={catalog.barbers} tz={shop.timezone} />
        </section>
      </PageBody>
    </>
  );
}
