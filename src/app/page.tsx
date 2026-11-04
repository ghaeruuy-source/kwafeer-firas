import Link from "next/link";
import { ArrowLeft, Clock3, MapPin, Phone, Scissors } from "lucide-react";
import { getNextFreeSlot, getStorefront } from "@/lib/shop";
import { openStatus } from "@/lib/hours";
import { formatDuration, formatIQD, formatInstantTime, formatPhone, whatsappLink } from "@/lib/format";
import { addDays, todayKey, weekdayOf, WEEKDAYS } from "@/lib/time";
import { DEFAULT_LOGO, SiteHeader } from "@/components/site/SiteHeader";
import { ParticleCrest } from "@/components/site/ParticleCrest";
import { SectionTitle } from "@/components/site/SectionTitle";
import { StickyBookBar, WhatsAppFab } from "@/components/site/StickyBookBar";
import { SetupNotice } from "@/components/site/SetupNotice";
import { InstagramIcon, Monogram, WhatsAppIcon } from "@/components/ui/icons";
import { EmptyState } from "@/components/ui/Feedback";
import { InstallApp } from "@/components/site/InstallApp";
import { OrnateTitle } from "@/components/site/OrnateTitle";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const sf = await getStorefront();
  return sf ? { title: `${sf.shop.name} | احجز موعدك`, description: sf.shop.tagline ?? undefined } : {};
}

// Saturday-first order, the way Iraqi shops write their week

export default async function HomePage() {
  const sf = await getStorefront();
  if (!sf) return <SetupNotice />;
  const { shop, services, barbers, hours } = sf;
  const status = openStatus(hours, shop.timezone);
  const next = await getNextFreeSlot(sf);
  const today = todayKey(shop.timezone);
  const nextDay = next && (next.date === today ? "اليوم" : next.date === addDays(today, 1) ? "باجر" : WEEKDAYS[weekdayOf(next.date)]);

  return (
    <>
      <SiteHeader shop={shop} />

      <main className="pb-28 md:pb-0">
        {/* Hero */}
        <section className="grain relative overflow-hidden border-b border-line-soft">
          {shop.cover_url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={shop.cover_url} alt="" className="absolute inset-0 size-full object-cover opacity-35" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
            </>
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-30%,rgba(200,155,90,0.25),transparent_65%)]" />
          )}
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-10 px-4 py-16 text-center sm:px-6 sm:py-24">
            <div className="flex animate-rise flex-col items-center">
              <ParticleCrest src={shop.logo_url || DEFAULT_LOGO} alt={shop.name} />
              <span
                className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
                  status.open ? "border-gold/25 bg-gold/15 text-[#e3c08b]" : "border-line bg-coal-2 text-mute"
                }`}
              >
                <span className={`size-1.5 rounded-full ${status.open ? "bg-gold-light animate-pulse" : "bg-faint"}`} />
                {status.label}
              </span>
              <OrnateTitle text={shop.name} />
              <Link
                href="/book"
                className="book-now group mt-7 inline-flex h-16 w-full max-w-xs items-center justify-center gap-3 rounded-full bg-gradient-to-b from-gold-light to-gold-deep px-8 text-xl font-bold text-ink shadow-[0_14px_44px_-14px_rgba(200,155,90,0.8)] transition hover:brightness-105"
              >
                احجز الآن
                <ArrowLeft className="size-6 transition group-hover:-translate-x-1" />
              </Link>
              {next && (
                <Link
                  href={`/book?date=${next.date}&at=${encodeURIComponent(next.at)}`}
                  className="mt-3 inline-flex items-center gap-2 rounded-full border border-gold/25 bg-gold/[0.08] px-4 py-2 text-sm text-[#e3c08b] transition hover:border-gold/50 active:scale-[0.98]"
                >
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-gold-light/60" />
                    <span className="relative inline-flex size-2 rounded-full bg-gold-light" />
                  </span>
                  أقرب موعد فارغ: {nextDay} <span className="num">{formatInstantTime(next.at, shop.timezone)}</span>
                </Link>
              )}
              {shop.tagline && <p className="mt-6 max-w-xl text-lg leading-8 text-mute">{shop.tagline}</p>}
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {shop.whatsapp && (
                  <a
                    href={whatsappLink(shop.whatsapp, "مرحبا، أريد أستفسر عن موعد")}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-14 items-center gap-2.5 rounded-full border border-line bg-coal-2/70 px-6 text-bone transition hover:border-emerald-500/40 hover:text-emerald-300"
                  >
                    <WhatsAppIcon className="size-5" />
                    واتساب
                  </a>
                )}
                <Link href="/booking" className="inline-flex h-14 items-center gap-2.5 rounded-full border border-line bg-coal-2/70 px-6 text-bone transition hover:border-gold/40">
                  حجوزاتي
                </Link>
              </div>
            </div>

            {shop.about && (
              <div className="max-w-xl animate-rise rounded-[14px] border border-line-soft bg-coal/70 p-6 [animation-delay:120ms]">
                <Scissors className="mx-auto size-5 text-gold" />
                <p className="mt-4 leading-8 text-bone/85">{shop.about}</p>
              </div>
            )}
          </div>
        </section>

        {/* Services menu */}
        <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <SectionTitle id="services" eyebrow="قائمة الخدمات" title="الخدمات والأسعار" />
          {services.length === 0 ? (
            <EmptyState icon={Scissors} title="الخدمات راح تنضاف قريباً" description="تكدر تتواصل ويانا على الواتساب لحد ما تكمل القائمة." />
          ) : (
            <ul className="mt-10 grid gap-x-14 gap-y-1 md:grid-cols-2">
              {services.map((s) => (
                <li key={s.id}>
                  <Link href={`/book?service=${s.id}`} className="group flex items-baseline gap-3 rounded-xl px-2 py-4 transition hover:bg-coal/60">
                    <span className="min-w-0 max-w-[70%]">
                      <span className="block font-medium text-bone transition group-hover:text-gold-light">{s.name}</span>
                      <span className="mt-1 flex items-start gap-1.5 text-xs leading-5 text-faint">
                        <Clock3 className="mt-0.5 size-3.5 shrink-0" />
                        <span>{s.description || formatDuration(s.duration_minutes)}</span>
                      </span>
                    </span>
                    <span className="mx-1 min-w-4 flex-1 translate-y-[-4px] border-b border-dotted border-line" />
                    <span className="num shrink-0 font-display text-lg text-gold">{formatIQD(s.price_iqd)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-6 px-2 text-xs text-faint">نعمل بنظام الحجز. بدون إحراج لطفاً، الأسعار ثابتة.</p>
        </section>

        {/* Team */}
        {barbers.length > 0 && (
          <section className="border-y border-line-soft bg-coal/40">
            <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
              <SectionTitle id="team" eyebrow="فريقنا" title="الحلاقين" />
              <div className="no-scrollbar mt-10 -mx-4 flex snap-x gap-4 overflow-x-auto px-4 sm:mx-0 sm:grid sm:grid-cols-3 sm:px-0 lg:grid-cols-4">
                {barbers.map((b) => (
                  <Link
                    key={b.id}
                    href={`/book?barber=${b.id}`}
                    className="group w-44 shrink-0 snap-start overflow-hidden rounded-[14px] border border-line-soft bg-coal transition hover:border-gold/40 sm:w-auto"
                  >
                    <div className="relative aspect-[4/5] bg-coal-2">
                      {b.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={b.photo_url} alt={b.name} className="size-full object-cover grayscale-[30%] transition duration-500 group-hover:scale-105 group-hover:grayscale-0" />
                      ) : (
                        <div className="grid size-full place-items-center">
                          <Monogram name={b.name} className="size-20 text-4xl" />
                        </div>
                      )}
                    </div>
                    <div className="p-4">
                      <p className="font-medium">{b.name}</p>
                      <p className="mt-0.5 text-xs text-mute">{b.title || "حلاق"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Visit */}
        <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
          <div>
            <SectionTitle id="visit" eyebrow="زورونا" title="الموقع والتواصل" />
            <div className="mt-8 space-y-3">
              {shop.address && (
                <InfoRow icon={<MapPin className="size-5" />} label="العنوان" value={shop.address} href={shop.maps_url ?? undefined} cta="افتح بالخريطة" />
              )}
              {shop.phone && <InfoRow icon={<Phone className="size-5" />} label="الهاتف" value={<span className="num">{formatPhone(shop.phone)}</span>} href={`tel:+${shop.phone}`} cta="اتصل" />}
              {shop.whatsapp && (
                <InfoRow icon={<WhatsAppIcon className="size-5" />} label="واتساب" value={<span className="num">{formatPhone(shop.whatsapp)}</span>} href={whatsappLink(shop.whatsapp)} cta="راسلنا" />
              )}
              {shop.instagram && (
                <InfoRow icon={<InstagramIcon className="size-5" />} label="انستغرام" value={<span className="num">@{shop.instagram}</span>} href={`https://instagram.com/${shop.instagram}`} cta="تابعنا" />
              )}
            </div>
            <Link
              href="/booking"
              className="mt-6 flex items-center justify-between rounded-[14px] border border-dashed border-line px-5 py-4 text-sm text-mute transition hover:border-gold/50 hover:text-bone"
            >
              عندك حجز؟ شوف حالته أو ألغيه
              <ArrowLeft className="size-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-soft py-8 pb-32 text-center text-xs text-faint md:pb-8">
        © {new Date().getFullYear()} {shop.name}
        <InstallApp />
      </footer>

      <StickyBookBar whatsapp={shop.whatsapp} />
      <WhatsAppFab whatsapp={shop.whatsapp} />
    </>
  );
}

function InfoRow({ icon, label, value, href, cta }: { icon: React.ReactNode; label: string; value: React.ReactNode; href?: string; cta: string }) {
  const content = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-coal-2 text-gold">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-faint">{label}</span>
        <span className="block truncate text-bone">{value}</span>
      </span>
      {href && <span className="text-xs text-gold">{cta}</span>}
    </>
  );
  const cls = "flex items-center gap-4 rounded-[14px] border border-line-soft bg-coal/60 px-4 py-3.5 transition";
  return href ? (
    <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={`${cls} hover:border-gold/40`}>
      {content}
    </a>
  ) : (
    <div className={cls}>{content}</div>
  );
}
