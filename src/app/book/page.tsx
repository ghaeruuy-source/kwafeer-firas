import type { Metadata } from "next";
import { getStorefront } from "@/lib/shop";
import { SetupNotice } from "@/components/site/SetupNotice";
import { BookingWizard } from "@/components/booking/BookingWizard";
import { isDateKey } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "احجز موعدك" };

export default async function BookPage({ searchParams }: { searchParams: Promise<{ service?: string; barber?: string; date?: string; at?: string }> }) {
  const sf = await getStorefront();
  if (!sf) return <SetupNotice />;
  const sp = await searchParams;
  return (
    <BookingWizard
      shop={sf.shop}
      services={sf.services}
      barbers={sf.barbers}
      hours={sf.hours}
      initialServiceId={sf.services.some((s) => s.id === sp.service) ? sp.service! : null}
      initialBarberId={sf.barbers.some((b) => b.id === sp.barber) ? sp.barber! : null}
      initialDate={isDateKey(sp.date) ? sp.date : null}
      initialAt={sp.at && !Number.isNaN(Date.parse(sp.at)) ? sp.at : null}
    />
  );
}
