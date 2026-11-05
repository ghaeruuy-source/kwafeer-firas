import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Phone } from "lucide-react";
import { requireAdmin } from "@/lib/shop";
import { getCatalog } from "@/lib/admin-data";
import { BOOKING_SELECT, type BookingWithRelations, type Customer } from "@/lib/types";
import { formatIQD, formatPhone, whatsappLink } from "@/lib/format";
import { uuid } from "@/lib/validation";
import { PageBody, PageHeader } from "@/components/admin/PageHeader";
import { BookingsBoard } from "@/components/admin/BookingsBoard";
import { BookingList } from "@/components/admin/BookingList";
import { CustomerNotesForm } from "@/components/admin/CustomerNotesForm";
import { StatCard } from "@/components/admin/StatCard";
import { Card, CardHeader } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { WhatsAppIcon } from "@/components/ui/icons";
import { CalendarCheck2, UserX, Wallet } from "lucide-react";
import { LoyaltyCard } from "@/components/ui/LoyaltyCard";
import { loyaltyConfig, loyaltyProgress } from "@/lib/loyalty";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const { supabase, shop } = await requireAdmin();

  const [{ data: customer }, { data: bookingsData }, catalog] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle(),
    supabase.from("bookings").select(BOOKING_SELECT).eq("customer_id", id).order("starts_at", { ascending: false }).limit(100),
    getCatalog(supabase, shop.id),
  ]);
  if (!customer) notFound();
  const c = customer as Customer;
  const bookings = (bookingsData ?? []) as BookingWithRelations[];
  const completed = bookings.filter((b) => b.status === "completed");
  const spent = completed.reduce((s, b) => s + b.price_iqd, 0);
  const loyalty = loyaltyConfig(shop);

  return (
    <BookingsBoard shop={shop} services={catalog.services} barbers={catalog.barbers}>
      <PageHeader
        title={c.name}
        description={<span className="num">{formatPhone(c.phone)}</span>}
        actions={
          <>
            <ButtonLink href={whatsappLink(c.phone)} variant="outline" size="sm">
              <WhatsAppIcon className="size-4 text-emerald-400" /> واتساب
            </ButtonLink>
            <ButtonLink href={`tel:+${c.phone}`} variant="outline" size="sm">
              <Phone className="size-4" /> اتصال
            </ButtonLink>
          </>
        }
      />
      <PageBody>
        <Link href="/admin/customers" className="inline-flex items-center gap-1.5 text-sm text-mute hover:text-bone">
          <ArrowRight className="size-4" /> كل الزباين
        </Link>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="زيارات مكتملة" value={completed.length} icon={CalendarCheck2} accent />
          <StatCard label="غياب" value={bookings.filter((b) => b.status === "no_show").length} icon={UserX} />
          <StatCard label="مجموع الدفع" value={formatIQD(spent)} icon={Wallet} />
        </div>
        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
          {loyalty && <LoyaltyCard p={loyaltyProgress(completed.length, loyalty)} audience="admin" />}
          <Card>
            <CardHeader title="ملف الزبون" description="الملاحظات تظهر بكل حجز لهذا الزبون" />
            <div className="p-5">
              <CustomerNotesForm customer={c} />
            </div>
          </Card>
          </div>
          <Card>
            <CardHeader title="سجل الحجوزات" description={`${bookings.length} حجز`} />
            <BookingList bookings={bookings} tz={shop.timezone} showDate emptyTitle="ما عنده حجوزات" />
          </Card>
        </div>
      </PageBody>
    </BookingsBoard>
  );
}
