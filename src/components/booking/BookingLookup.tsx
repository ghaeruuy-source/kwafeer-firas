"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Search, XCircle } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { WhatsAppIcon } from "@/components/ui/icons";
import { formatIQD, formatInstantDate, formatInstantTime, formatPhonePlain, whatsappLink } from "@/lib/format";
import type { PublicBooking, Shop } from "@/lib/types";

const STATUS_HINT: Record<PublicBooking["status"], string> = {
  pending: "الصالون راح يأكد حجزك قريباً.",
  confirmed: "حجزك مؤكد. يفضل توصل قبل الموعد بـ 5 دقايق.",
  completed: "نتمنى عجبتك الخدمة. نشوفك المرة الجاية.",
  cancelled: "هذا الحجز ملغي. تكدر تحجز موعد جديد بأي وقت.",
  no_show: "ما حضرت للموعد. احجز موعد جديد متى ما يناسبك.",
};

export function BookingLookup({ shop, initialCode, initialPhone }: { shop: Shop; initialCode: string; initialPhone: string }) {
  const [code, setCode] = useState(initialCode);
  const [phone, setPhone] = useState(initialPhone ? formatPhonePlain(initialPhone) : "");
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [recent, setRecent] = useState<{ code: string; phone: string }[]>([]);

  const lookup = useCallback(async (c: string, p: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: c, phone: p }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setBooking(body.booking);
    } catch (e) {
      setBooking(null);
      setError(e instanceof Error ? e.message : "تعذر جلب الحجز");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      setRecent(JSON.parse(localStorage.getItem("barber.bookings") || "[]"));
    } catch {
      /* ignore */
    }
    if (initialCode && initialPhone) lookup(initialCode, initialPhone);
  }, [initialCode, initialPhone, lookup]);

  async function cancel() {
    setCancelling(true);
    try {
      const res = await fetch("/api/bookings/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, phone }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error);
      setBooking(body.booking);
      setConfirmCancel(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "تعذر الإلغاء");
      setConfirmCancel(false);
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="mx-auto max-w-md px-5 py-10">
      <h1 className="font-display text-3xl">حجوزاتي</h1>
      <p className="mt-2 text-sm text-mute">اكتب رمز الحجز ورقم موبايلك حته تشوف حالة الحجز.</p>

      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          lookup(code, phone);
        }}
      >
        <Input
          label="رمز الحجز"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="مثلاً: K7M2QX"
          maxLength={6}
          dir="ltr"
          className="num text-center font-display tracking-[0.3em] uppercase"
          autoCapitalize="characters"
        />
        <Input label="رقم الموبايل" type="tel" inputMode="tel" dir="ltr" className="text-right" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="07XX XXX XXXX" />
        <Button type="submit" className="w-full" size="lg" loading={loading} disabled={code.length < 6 || phone.length < 10}>
          <Search className="size-5" />
          ابحث
        </Button>
      </form>

      {!booking && recent.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-xs text-faint">حجوزاتك الأخيرة على هذا الجهاز</p>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <button
                key={r.code}
                onClick={() => {
                  setCode(r.code);
                  setPhone(formatPhonePlain(r.phone));
                  lookup(r.code, r.phone);
                }}
                className="num rounded-xl border border-line px-3 py-1.5 text-sm tracking-widest text-mute hover:border-gold/50 hover:text-gold-light"
              >
                {r.code}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <Alert className="mt-6">{error}</Alert>}

      {booking && (
        <div className="mt-8 overflow-hidden rounded-3xl border border-line-soft bg-coal animate-rise">
          <div className="flex items-center justify-between border-b border-line-soft px-5 py-4">
            <span className="num font-display text-xl tracking-[0.25em] text-gold">{booking.code}</span>
            <StatusBadge status={booking.status} />
          </div>
          <div className="px-5 py-5">
            <p className="text-sm text-mute">{STATUS_HINT[booking.status]}</p>
            <dl className="mt-5 space-y-3.5 text-sm">
              <Row label="الاسم" value={booking.customer_name} />
              <Row label="الخدمة" value={booking.service_name} />
              <Row label="الحلاق" value={booking.barber_name} />
              <Row label="اليوم" value={formatInstantDate(booking.starts_at, shop.timezone)} />
              <Row label="الوقت" value={<span className="num">{formatInstantTime(booking.starts_at, shop.timezone)}</span>} />
              <Row label="السعر" value={<span className="num">{formatIQD(booking.price_iqd)}</span>} />
            </dl>
          </div>
          <div className="space-y-2 border-t border-line-soft px-5 py-4">
            {shop.whatsapp && (
              <ButtonLink href={whatsappLink(shop.whatsapp, `مرحبا، بخصوص حجزي رقم ${booking.code}`)} variant="outline" className="w-full">
                <WhatsAppIcon className="size-4 text-emerald-400" />
                تواصل ويا الصالون
              </ButtonLink>
            )}
            {booking.can_cancel && (
              <Button variant="danger" className="w-full" onClick={() => setConfirmCancel(true)}>
                <XCircle className="size-4" />
                إلغاء الحجز
              </Button>
            )}
            {(booking.status === "cancelled" || booking.status === "completed" || booking.status === "no_show") && (
              <ButtonLink href="/book" className="w-full">
                <CalendarClock className="size-4" />
                احجز موعد جديد
              </ButtonLink>
            )}
          </div>
        </div>
      )}

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="متأكد تريد تلغي؟"
        footer={
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" loading={cancelling} onClick={cancel}>
              نعم، ألغِ الحجز
            </Button>
            <Button variant="ghost" className="flex-1" onClick={() => setConfirmCancel(false)}>
              لا، خليه
            </Button>
          </div>
        }
      >
        <p className="text-sm text-mute">راح ينفتح الوقت لغيرك، وما تكدر ترجع نفس الحجز بعدين.</p>
      </Modal>
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
