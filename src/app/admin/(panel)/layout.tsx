import type { Metadata } from "next";
import { requireAdmin } from "@/lib/shop";
import { AdminMobileNav, AdminSidebar } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const metadata: Metadata = { title: { default: "لوحة التحكم", template: "%s | لوحة التحكم" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { shop, user, supabase } = await requireAdmin();
  // Upcoming bookings still waiting for a reply: shown as a badge on "الحجوزات"
  const { count } = await supabase
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("shop_id", shop.id)
    .eq("status", "pending")
    .gt("starts_at", new Date().toISOString());
  const pending = count ?? 0;
  return (
    <div className="flex min-h-dvh">
      <AdminSidebar shopName={shop.name} email={user.email ?? ""} pending={pending} />
      <div className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</div>
      <AdminMobileNav pending={pending} />
    </div>
  );
}
