import type { Metadata } from "next";
import { getStorefront } from "@/lib/shop";
import { SetupNotice } from "@/components/site/SetupNotice";
import { SiteHeader } from "@/components/site/SiteHeader";
import { BookingLookup } from "@/components/booking/BookingLookup";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "حجوزاتي" };

export default async function BookingStatusPage({ searchParams }: { searchParams: Promise<{ code?: string; phone?: string }> }) {
  const sf = await getStorefront();
  if (!sf) return <SetupNotice />;
  const sp = await searchParams;
  return (
    <>
      <SiteHeader shop={sf.shop} />
      <BookingLookup shop={sf.shop} initialCode={sp.code ?? ""} initialPhone={sp.phone ?? ""} />
    </>
  );
}
