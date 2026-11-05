"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, Clock3, Scissors, CalendarX2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { ShopMark } from "@/components/site/SiteHeader";
import { BookingSuccess } from "./BookingSuccess";
import { VipWaitlist } from "./VipWaitlist";
import { BarberPicker, barberPhoto } from "./BarberPicker";
import { formatDateKey, formatDuration, formatIQD, formatInstantTime, formatPhone, formatTime12, normalizeIraqiPhone } from "@/lib/format";
import { addDays, hhmm, todayKey, toTimeKey, weekdayOf } from "@/lib/time";
import type { Barber, Service, Shop, Slot, WorkingHours, BookingStatus } from "@/lib/types";

type Step = "barber" | "day" | "time" | "service" | "details" | "review" | "done";

export interface CreatedBooking {
  code: string;
  status: BookingStatus;
  starts_at: string;
  ends_at: string;
  barber_name?: string;
}

const STORAGE_KEY = "barber.customer";

export function BookingWizard({
  shop,
  services,
  barbers,
  hours,
  initialServiceId,
  initialBarberId,
  initialDate = null,
  initialAt = null,
}: {
  shop: Shop;
  services: Service[];
  barbers: Barber[];
  hours: WorkingHours[];
  initialServiceId: string | null;
  initialBarberId: string | null;
  /** Deep link from the home page's "next free time" pill. */
  initialDate?: string | null;
  initialAt?: string | null;
}) {
  // Flow the shop asked for: barber → day → time → service → details → review → done.
  // Each barber has his own times. With one barber (or a link that pre-picks one) the first step is skipped.
  const pickBarber = barbers.length > 1;
  const [barberId, setBarberId] = useState<string | null>(initialBarberId ?? (pickBarber ? null : barbers[0]?.id ?? null));
  const barber = barbers.find((b) => b.id === barberId) ?? null;
  const [step, setStep] = useState<Step>(pickBarber && !initialBarberId ? "barber" : initialDate ? "time" : "day");
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId);

  const [date, setDate] = useState<string | null>(initialDate);
  const pendingAt = useRef(initialAt);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsError, setSlotsError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ booking: CreatedBooking; phone: string } | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  // Times are looked up with the chosen service, or before that with the shortest one
  const refService = service ?? [...services].sort((a, b) => a.duration_minutes - b.duration_minutes)[0] ?? null;
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.name) setName(saved.name);
      if (saved?.phone) setPhone(saved.phone);
    } catch {
      /* storage unavailable */
    }
  }, []);

  // Dates within the booking window, with the shop's hours for each
  const days = useMemo(() => {
    const today = todayKey(shop.timezone);
    const span = Math.min(shop.booking_window_days, 30);
    return Array.from({ length: span + 1 }, (_, i) => addDays(today, i)).map((key, i) => {
      const wh = hours.find((h) => h.weekday === weekdayOf(key));
      return { key, i, open: Boolean(wh?.is_open), from: wh ? hhmm(wh.open_time) : "", to: wh ? hhmm(wh.close_time) : "" };
    });
  }, [hours, shop.booking_window_days, shop.timezone]);

  // Free-time count per day for the day list (one light request per open day)
  const [freeByDay, setFreeByDay] = useState<Record<string, number>>({});
  useEffect(() => {
    if (step !== "day" || !refService) return;
    let alive = true;
    days.filter((d) => d.open).forEach(async (d) => {
      try {
        const qs = new URLSearchParams({ service: refService.id, date: d.key });
        if (barberId) qs.set("barber", barberId);
        const res = await fetch(`/api/slots?${qs}`, { cache: "no-store" });
        if (!res.ok) return;
        const body: { slots: Slot[] } = await res.json();
        if (alive) setFreeByDay((m) => ({ ...m, [d.key]: body.slots.filter((x) => x.available).length }));
      } catch {
        /* the count is a nicety; the day stays tappable */
      }
    });
    return () => {
      alive = false;
    };
  }, [step, days, refService, barberId]);

  const loadSlots = useCallback(async () => {
    if (!refService || !date) return;
    setSlotsLoading(true);
    setSlotsError(null);
    try {
      const qs = new URLSearchParams({ service: refService.id, date });
      if (barberId) qs.set("barber", barberId);
      const res = await fetch(`/api/slots?${qs}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "تعذر تحميل الأوقات");
      setSlots(body.slots);
    } catch (e) {
      setSlots(null);
      setSlotsError(e instanceof Error ? e.message : "تعذر تحميل الأوقات");
    } finally {
      setSlotsLoading(false);
    }
  }, [refService, date, barberId]);

  useEffect(() => {
    if (step === "time") loadSlots();
  }, [step, loadSlots]);

  // Deep link: once the day's times arrive, pick the linked one if it is still free
  useEffect(() => {
    if (!slots || !pendingAt.current) return;
    const want = new Date(pendingAt.current).getTime();
    pendingAt.current = null;
    const hit = slots.find((x) => x.available && new Date(x.slot_start).getTime() === want);
    if (hit) {
      setSlot(hit);
      setStep("service");
    }
  }, [slots]);

  const go = (s: Step) => {
    setStep(s);
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const steps: { id: Step; label: string }[] = [
    ...(pickBarber ? [{ id: "barber" as Step, label: "الحلاق" }] : []),
    { id: "day", label: "اليوم" },
    { id: "time", label: "الوقت" },
    { id: "service", label: "الخدمة" },
    { id: "details", label: "معلوماتك" },
    { id: "review", label: "التأكيد" },
  ];
  const stepIndex = steps.findIndex((s) => s.id === step);
  const prev: Partial<Record<Step, Step>> = { ...(pickBarber ? { day: "barber" as Step } : {}), time: "day", service: "time", details: "service", review: "details" };

  function toReview() {
    const errs: typeof fieldErrors = {};
    const cleanName = name.replace(/\s+/g, " ").trim();
    if (cleanName.length < 2) errs.name = "اكتب اسمك (حرفين على الأقل)";
    if (!normalizeIraqiPhone(phone)) errs.phone = "رقم الموبايل غير صحيح. اكتبه مثل 07701234567";
    setFieldErrors(errs);
    if (Object.keys(errs).length) return;
    setName(cleanName);
    go("review");
  }

  async function submit() {
    if (!service || !slot) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serviceId: service.id, barberId, startsAt: slot.slot_start, name, phone, note: null }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSubmitError(body.error);
          setSlot(null);
          go("time");
          return;
        }
        throw new Error(body.error || "تعذر إتمام الحجز");
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, phone }));
        const history = JSON.parse(localStorage.getItem("barber.bookings") || "[]");
        localStorage.setItem("barber.bookings", JSON.stringify([{ code: body.booking.code, phone: body.phone }, ...history].slice(0, 5)));
      } catch {
        /* ignore */
      }
      setCreated({ booking: body.booking, phone: body.phone });
      go("done");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "تعذر إتمام الحجز");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "done" && created && service) {
    return <BookingSuccess shop={shop} service={service} barberName={created.booking.barber_name ?? null} booking={created.booking} phone={created.phone} customerName={name.replace(/\s+/g, " ").trim()} />;
  }

  const groupedSlots = groupSlots(slots ?? [], shop.timezone);
  const whenLabel = date && slot ? `${formatDateKey(date, { weekday: "long", day: "numeric", month: "long" })} · ${formatInstantTime(slot.slot_start, shop.timezone)}` : "";

  return (
    <div className="min-h-dvh pb-44">
      <header className="sticky top-0 z-30 border-b border-line-soft bg-ink/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-3">
            <ShopMark shop={shop} />
            <span className="font-display">{shop.name}</span>
          </Link>
          <Link href="/" className="text-sm text-mute hover:text-bone">
            إلغاء
          </Link>
        </div>
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <ol className="flex gap-1.5">
            {steps.map((s, i) => (
              <li key={s.id} className="flex-1">
                <div className={cn("h-1 rounded-full transition-colors duration-500", i <= stepIndex ? "bg-gold" : "bg-line")} />
                <span className={cn("mt-1.5 block text-[11px]", i === stepIndex ? "text-gold-light" : "text-faint")}>{s.label}</span>
              </li>
            ))}
          </ol>
        </div>
      </header>

      <div ref={topRef} className="mx-auto max-w-2xl scroll-mt-32 px-4 pt-8">
        {prev[step] && (
          <button onClick={() => go(prev[step]!)} className="mb-5 inline-flex items-center gap-1.5 text-sm text-mute hover:text-bone">
            <ArrowRight className="size-4" />
            رجوع
          </button>
        )}

        {step === "barber" && (
          <StepShell title="منو تحب يحلقلك؟" subtitle="كل حلاق إله مواعيده الخاصة.">
            <BarberPicker
              barbers={barbers}
              selectedId={barberId}
              onPick={(id) => {
                if (id !== barberId) {
                  setFreeByDay({});
                  setSlots(null);
                  setSlot(null);
                }
                setBarberId(id);
                setSubmitError(null);
                go(date ? "time" : "day");
              }}
            />
          </StepShell>
        )}

        {step === "day" && (
          <StepShell title="أي يوم يناسبك؟" subtitle={[barber && pickBarber ? `ويا ${barber.name}` : null, refService ? `كل موعد ${formatDuration(refService.duration_minutes)}` : null].filter(Boolean).join(" · ") || undefined}>
            {services.length === 0 ? (
              <EmptyState icon={Scissors} title="الحجز راح يفتح قريباً" description="تواصل ويا الصالون على الواتساب." />
            ) : (
              <div className="space-y-2">
                {days.map((d) => {
                  const free = freeByDay[d.key];
                  const full = d.open && free === 0;
                  return (
                  <button
                    key={d.key}
                    disabled={!d.open}
                    onClick={() => {
                      setDate(d.key);
                      setSlot(null);
                      setSubmitError(null);
                      go("time");
                    }}
                    style={{ animationDelay: `${Math.min(d.i, 12) * 28}ms` }}
                    className={cn(
                      "flex w-full animate-rise items-center gap-4 rounded-[14px] border px-4 py-3 text-right transition active:scale-[0.99]",
                      d.key === date ? "border-gold/70 bg-gold/[0.07]" : "border-line-soft bg-coal hover:border-gold/40",
                      !d.open && "cursor-not-allowed opacity-45",
                      full && "border-gold/25 opacity-80",
                    )}
                  >
                    <span className="num grid size-12 shrink-0 place-items-center rounded-full border border-gold/40 font-display text-xl text-gold-light">
                      {Number(d.key.slice(8))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{d.i === 0 ? "اليوم" : d.i === 1 ? "باجر" : formatDateKey(d.key, { weekday: "long" })}</span>
                      <span className="block text-xs text-faint">
                        {formatDateKey(d.key, { weekday: d.i < 2 ? "long" : undefined, day: "numeric", month: "long" })}
                        {d.open && ` · ${formatTime12(d.from)} – ${formatTime12(d.to)}`}
                      </span>
                    </span>
                    <span className={cn("shrink-0 text-xs", d.open && !full ? "text-gold-light" : "text-faint")}>
                      {!d.open ? "عطلة" : free === undefined ? <span className="shimmer inline-block h-3 w-16 rounded-full" /> : full ? <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-gold-light">ممتلئ · سجّل VIP</span> : free === 1 ? "وقت واحد فارغ" : `${free} أوقات فارغة`}
                    </span>
                  </button>
                  );
                })}
              </div>
            )}
          </StepShell>
        )}

        {step === "time" && date && (
          <StepShell title={formatDateKey(date, { weekday: "long", day: "numeric", month: "long" })} subtitle="اختار الوقت اللي يناسبك. الوقت المضلل محجوز.">
            {submitError && <Alert className="mb-5">{submitError}</Alert>}
            {slotsLoading ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="shimmer h-12 rounded-xl" />
                ))}
              </div>
            ) : slotsError ? (
              <div className="space-y-3">
                <Alert>{slotsError}</Alert>
                <Button variant="outline" size="sm" onClick={loadSlots}>
                  <RefreshCw className="size-4" /> حاول مرة ثانية
                </Button>
              </div>
            ) : groupedSlots.length === 0 ? (
              <div className="space-y-5">
                <EmptyState icon={CalendarX2} title="ما اكو أوقات بهذا اليوم" description="ارجع واختار يوم ثاني، أو سجّل بقائمة VIP." />
                <VipWaitlist date={date} />
              </div>
            ) : (
              <div className="space-y-6">
                {!groupedSlots.some((g) => g.slots.some((x) => x.available)) && (
                  <div className="space-y-3">
                    <p className="rounded-xl border border-line-soft bg-coal-2 px-4 py-3 text-sm text-mute">هذا اليوم كله محجوز. ارجع واختار يوم ثاني، أو سجّل بقائمة VIP.</p>
                    <VipWaitlist date={date} />
                  </div>
                )}
                {groupedSlots.map((g) => (
                  <div key={g.label}>
                    <p className="mb-2.5 text-xs font-medium text-faint">{g.label}</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {g.slots.map((s) => {
                        const taken = !s.available;
                        const label = formatInstantTime(s.slot_start, shop.timezone);
                        return (
                          <button
                            key={s.slot_start}
                            type="button"
                            disabled={taken}
                            aria-label={taken ? `${label} محجوز` : undefined}
                            onClick={() => {
                              setSlot(s);
                              setSubmitError(null);
                              go("service");
                            }}
                            className={cn(
                              "num flex h-12 animate-rise flex-col items-center justify-center rounded-xl border text-[15px] leading-tight transition active:scale-95",
                              taken
                                ? "cursor-not-allowed border-line-soft/50 bg-coal-2/50 text-faint/60"
                                : slot?.slot_start === s.slot_start
                                  ? "border-gold bg-gold font-semibold text-ink"
                                  : "border-line-soft bg-coal hover:border-gold/50",
                            )}
                          >
                            <span className={cn(taken && "line-through decoration-faint/50")}>{label}</span>
                            {taken && <span className="text-[10px] font-normal">محجوز</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </StepShell>
        )}

        {step === "service" && (
          <StepShell title="شنو تريد تسوي؟" subtitle={whenLabel}>
            <div className="space-y-2.5">
              {services.map((s) => (
                <ChoiceCard
                  key={s.id}
                  selected={s.id === serviceId}
                  onClick={() => {
                    setServiceId(s.id);
                    go("details");
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{s.name}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-faint">
                      <Clock3 className="size-3.5 shrink-0" />
                      <span className="truncate">{s.description || formatDuration(s.duration_minutes)}</span>
                    </p>
                  </div>
                  <span className="num shrink-0 font-display text-gold">{formatIQD(s.price_iqd)}</span>
                </ChoiceCard>
              ))}
            </div>
          </StepShell>
        )}

        {step === "details" && (
          <StepShell title="معلوماتك" subtitle="بس اسمك ورقمك، حته نأكدلك الحجز.">
            <div className="space-y-4">
              <Input label="الاسم" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={fieldErrors.name} placeholder="مثلاً: علي حسين" maxLength={60} />
              <Input
                label="رقم الموبايل"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                className="text-right"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                error={fieldErrors.phone}
                hint="نستخدمه للتأكيد على الواتساب فقط"
                placeholder="07XX XXX XXXX"
              />
            </div>
          </StepShell>
        )}

        {step === "review" && service && slot && date && (
          <StepShell title="راجع حجزك" subtitle={'تأكد من التفاصيل واضغط "أكد الحجز".'}>
            <dl className="space-y-3.5 rounded-[14px] border border-line-soft bg-coal px-5 py-5 text-sm">
              {barber && pickBarber && (
                <ReviewRow
                  label="الحلاق"
                  value={
                    <span className="inline-flex items-center gap-2">
                      {barberPhoto(barber) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={barberPhoto(barber)!} alt="" className="size-6 rounded-full border border-gold/50 object-cover" />
                      )}
                      {barber.name}
                    </span>
                  }
                />
              )}
              <ReviewRow label="اليوم" value={formatDateKey(date, { weekday: "long", day: "numeric", month: "long" })} />
              <ReviewRow label="الوقت" value={<span className="num">{formatInstantTime(slot.slot_start, shop.timezone)}</span>} />
              <ReviewRow label="الخدمة" value={service.name} />
              <ReviewRow label="السعر" value={<span className="num text-gold-light">{formatIQD(service.price_iqd)}</span>} />
              <ReviewRow label="الاسم" value={name} />
              <ReviewRow label="الرقم" value={<span className="num">{formatPhone(normalizeIraqiPhone(phone) ?? phone)}</span>} />
            </dl>
            <p className="mt-3 text-xs text-faint">بدون إحراج لطفاً، الأسعار ثابتة.</p>
            {submitError && <Alert className="mt-5">{submitError}</Alert>}
          </StepShell>
        )}
      </div>

      {(step === "details" || step === "review") && service && slot && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line-soft bg-[#0a221b]/95 backdrop-blur-xl">
          <div className="mx-auto max-w-2xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <div className="mb-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{service.name}</p>
                <p className="mt-0.5 truncate text-xs text-mute">{whenLabel}</p>
              </div>
              <span className="num shrink-0 font-display text-gold">{formatIQD(service.price_iqd)}</span>
            </div>
            {step === "details" ? (
              <Button className="w-full" size="lg" onClick={toReview}>
                التالي
                <ArrowLeft className="size-5" />
              </Button>
            ) : (
              <Button className="w-full" size="lg" loading={submitting} onClick={submit}>
                <Check className="size-5" />
                أكد الحجز
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-faint">{label}</dt>
      <dd className="text-left text-bone">{value}</dd>
    </div>
  );
}

function StepShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="animate-rise">
      <h1 className="font-display text-2xl sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-sm text-mute">{subtitle}</p>}
      <div className="mt-7">{children}</div>
    </section>
  );
}

function ChoiceCard({ selected, onClick, children }: { selected?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border px-4 py-4 text-right transition active:scale-[0.99]",
        selected ? "border-gold/70 bg-gold/[0.07]" : "border-line-soft bg-coal hover:border-gold/40",
      )}
    >
      {children}
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border", selected ? "border-gold bg-gold text-ink" : "border-line")}>
        {selected && <Check className="size-3.5" />}
      </span>
    </button>
  );
}

function groupSlots(slots: Slot[], tz: string) {
  const groups: { label: string; slots: Slot[] }[] = [
    { label: "الصبح", slots: [] },
    { label: "الظهر", slots: [] },
    { label: "العصر", slots: [] },
    { label: "المسا", slots: [] },
    { label: "الليل", slots: [] },
  ];
  for (const s of slots) {
    const h = Number(toTimeKey(new Date(s.slot_start), tz).slice(0, 2));
    groups[h < 12 ? 0 : h < 15 ? 1 : h < 18 ? 2 : h < 21 ? 3 : 4].slots.push(s);
  }
  return groups.filter((g) => g.slots.length);
}
