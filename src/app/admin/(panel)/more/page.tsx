import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { MoreMenu } from "@/components/admin/AdminNav";

export default function MorePage() {
  return (
    <>
      <PageHeader title="المزيد" />
      <PageBody>
        <MoreMenu />
      </PageBody>
    </>
  );
}
