"use client";

import { useState } from "react";
import Link from "next/link";
import { BellRing, Check, Copy, CalendarSearch, Download, MessageCircle, Share2 } from "lucide-react";
import { barberWhatsapp } from "./BarberPicker";
import { Button, ButtonLink } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatIQD, formatInstantDate, formatInstantTime } from "@/lib/format";
import type { Service, Shop } from "@/lib/types";
import type { CreatedBooking } from "./BookingWizard";

export function BookingSuccess({
  shop,
  service,
  barberName,
  booking,
  phone,
}: {
  shop: Shop;
  service: Service;
  barberName: string | null;
  booking: CreatedBooking;
  phone: string;
}) {
  const [copied, setCopied] = useState(false);
  const [receipt, setReceipt] = useState<"loading" | "ready" | "failed">("loading");
  const receiptUrl = `/api/booking-receipt?code=${encodeURIComponent(booking.code)}&phone=${encodeURIComponent(phone)}`;
  const wa = barberWhatsapp(barberName, shop.whatsapp);
  const when = `${formatInstantDate(booking.starts_at, shop.timezone)} الساعة ${formatInstantTime(booking.starts_at, shop.timezone)}`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <div className="animate-rise text-center">
        <div className="relative mx-auto grid size-20 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-gold/20 [animation-iteration-count:2]" />
          <span className="relative grid size-20 place-items-center rounded-full bg-gradient-to-b from-gold-light to-gold-deep text-ink">
            <Check className="size-9" strokeWidth={2.5} />
          </span>
        </div>
        <h1 className="mt-7 font-display text-3xl">{booking.status === "confirmed" ? "تم تأكيد حجزك" : "وصل حجزك"}</h1>
        <p className="mt-2 text-mute">
          {booking.status === "confirmed" ? "تفاصيل حجزك وصلت للصالون، ننتظرك بالموعد." : "تفاصيل حجزك وصلت للصالون. تكدر تتابع حالته بأي وقت."}
        </p>
      </div>

      {receipt !== "failed" && (
        <div className="mt-8 animate-rise [animation-delay:100ms]">
          <div className="relative overflow-hidden rounded-3xl">
            {receipt === "loading" && <div className="aspect-[1080/1900] w-full animate-pulse rounded-3xl bg-coal" />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={receiptUrl}
              alt={`وصل الحجز ${booking.code}`}
              onLoad={() => setReceipt("ready")}
              onError={() => setReceipt("failed")}
              className={receipt === "ready" ? "block w-full" : "absolute inset-0 opacity-0"}
            />
          </div>
          {receipt === "ready" && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <Button variant="outline" onClick={() => shareReceipt(receiptUrl, booking.code)}>
                <Share2 className="size-4" />
                دز الوصل
              </Button>
              <Button variant="outline" onClick={() => saveReceipt(receiptUrl, booking.code)}>
                <Download className="size-4" />
                احفظ الوصل
              </Button>
            </div>
          )}
        </div>
      )}

      {receipt === "failed" && (
      <div className="mt-8 overflow-hidden rounded-3xl border border-line-soft bg-coal animate-rise [animation-delay:100ms]">
        <div className="flex items-center justify-between border-b border-dashed border-line px-5 py-4">
          <div>
            <p className="text-xs text-faint">رمز الحجز</p>
            <p className="num mt-1 font-display text-2xl tracking-[0.25em] text-gold">{booking.code}</p>
          </div>
          <button
            onClick={() => {
              navigator.clipboard?.writeText(booking.code).then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-mute hover:text-bone"
          >
            {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            {copied ? "انتسخ" : "نسخ"}
          </button>
        </div>
        <dl className="space-y-3.5 px-5 py-5 text-sm">
          <Row label="الحالة" value={<StatusBadge status={booking.status} />} />
          <Row label="الخدمة" value={service.name} />
          <Row label="الحلاق" value={barberName ?? "يتحدد حسب الفارغ"} />
          <Row label="الموعد" value={when} />
          <Row label="السعر" value={<span className="num">{formatIQD(service.price_iqd)}</span>} />
        </dl>
      </div>
      )}

      <div className="mt-6 space-y-2.5 animate-rise [animation-delay:200ms]">
        <Button size="lg" className="w-full" onClick={() => downloadIcs(shop, service, booking)}>
          <BellRing className="size-5" />
          فعّل تذكير موعدي
        </Button>
        <p className="pb-1 text-center text-xs text-faint">يضيف الموعد لتقويم موبايلك، ويذكّرك قبلها بيوم وقبل ساعة.</p>
        <ButtonLink href={`/booking?code=${booking.code}&phone=${phone}`} variant="outline" size="lg" className="w-full">
          <CalendarSearch className="size-5" />
          تابع حالة الحجز
        </ButtonLink>
        {wa && (
          <ButtonLink
            href={`https://wa.me/${wa}?text=${encodeURIComponent(`هلو${barberName ? ` ${barberName}` : ""}، حجزت عندك ${when}. رمز الحجز ${booking.code}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="lg"
            className="w-full"
          >
            <MessageCircle className="size-5" />
            {barberName ? `راسل ${barberName} على الواتساب` : "راسل الصالون على الواتساب"}
          </ButtonLink>
        )}
        <Link href="/" className="block py-3 text-center text-sm text-mute hover:text-bone">
          رجوع للرئيسية
        </Link>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-faint">{label}</dt>
      <dd className="text-left text-bone">{value}</dd>
    </div>
  );
}

/** Calendar file with reminders a day and an hour before; opens in Google/Apple/Samsung calendar. */
function downloadIcs(shop: Shop, service: Service, booking: CreatedBooking) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const esc = (t: string) => t.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
  const ics = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//barber-booking//ar", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${booking.code}@barber-booking`, `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(booking.starts_at)}`, `DTEND:${f(booking.ends_at)}`,
    `SUMMARY:${esc(`${service.name} - ${shop.name}`)}`,
    ...(shop.address ? [`LOCATION:${esc(shop.address)}`] : []),
    `DESCRIPTION:${esc(`رمز الحجز ${booking.code}`)}`,
    "BEGIN:VALARM", "TRIGGER:-P1D", "ACTION:DISPLAY", `DESCRIPTION:${esc(`تذكير: موعدك باجر ب${shop.name}`)}`, "END:VALARM",
    "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${esc(`موعدك بعد ساعة ب${shop.name}`)}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `booking-${booking.code}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Shares the receipt picture (WhatsApp, Instagram…) where the phone supports it, otherwise saves it. */
async function shareReceipt(url: string, code: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const file = new File([blob], `wasl-${code}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: `وصل الحجز ${code}` });
      return;
    }
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return;
  }
  saveReceipt(url, code);
}

function saveReceipt(url: string, code: string) {
  const a = document.createElement("a");
  a.href = `${url}&download=1`;
  a.download = `wasl-${code}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
