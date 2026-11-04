import { requireAdmin } from "@/lib/shop";
import { getCatalog } from "@/lib/admin-data";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { ServicesManager } from "@/components/admin/ServicesManager";

export const metadata = { title: "الخدمات" };

export default async function ServicesPage() {
  const { supabase, shop } = await requireAdmin();
  const { services } = await getCatalog(supabase, shop.id);
  return (
    <>
      <PageHeader title="الخدمات والأسعار" description="المدة تحدد طول الموعد بالتقويم" />
      <PageBody>
        <ServicesManager services={services} />
      </PageBody>
    </>
  );
}
