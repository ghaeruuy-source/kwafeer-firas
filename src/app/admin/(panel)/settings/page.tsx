import { requireAdmin } from "@/lib/shop";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "الإعدادات" };

export default async function SettingsPage() {
  const { shop } = await requireAdmin();
  return (
    <>
      <PageHeader title="الإعدادات" />
      <PageBody>
        <SettingsForm shop={shop} />
      </PageBody>
    </>
  );
}
