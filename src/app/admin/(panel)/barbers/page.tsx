import { requireAdmin } from "@/lib/shop";
import { getCatalog } from "@/lib/admin-data";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { BarbersManager } from "@/components/admin/BarbersManager";

export const metadata = { title: "الحلاقين" };

export default async function BarbersPage() {
  const { supabase, shop } = await requireAdmin();
  const { barbers } = await getCatalog(supabase, shop.id);
  return (
    <>
      <PageHeader title="الحلاقين" description="كل حلاق عنده جدول مستقل، وما يصير عليه موعدين بنفس الوقت" />
      <PageBody>
        <BarbersManager barbers={barbers} />
      </PageBody>
    </>
  );
}
