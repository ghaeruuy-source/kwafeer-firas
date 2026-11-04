import type { Metadata } from "next";
import { requireAdmin } from "@/lib/shop";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: { default: "لوحة التحكم", template: "%s | لوحة التحكم" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { shop, user } = await requireAdmin();
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar shopName={shop.name} email={user.email ?? ""} />
      <div className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</div>
      <AdminMobileNav />
    </div>
  );
}
