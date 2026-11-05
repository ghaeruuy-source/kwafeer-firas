import { requireAdmin } from "@/lib/shop";
import { getCatalog } from "@/lib/admin-data";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { BarbersManager } from "@/components/admin/BarbersManager";
import { BarberReceiptLinks, type BarberNotify } from "@/components/admin/BarberReceiptLinks";

export const metadata = { title: "الحلاقين" };

export default async function BarbersPage() {
  const { supabase, shop } = await requireAdmin();
  const { barbers } = await getCatalog(supabase, shop.id);
  // Missing until the receipts migration is applied; the section simply stays hidden then.
  const { data: notify, error } = await supabase.rpc("admin_barber_notify", { p_shop_id: shop.id });
  return (
    <>
      <PageHeader title="الحلاقين" description="كل حلاق عنده جدول مستقل، وما يصير عليه موعدين بنفس الوقت" />
      <PageBody>
        <BarbersManager barbers={barbers} />
        {!error && barbers.length > 0 && (
          <BarberReceiptLinks barbers={barbers} notify={(notify ?? []) as BarberNotify[]} shopWhatsapp={shop.whatsapp} />
        )}
      </PageBody>
    </>
  );
}
