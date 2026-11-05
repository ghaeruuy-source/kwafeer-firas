"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarX2, Check, ChevronLeft, Clock, Scissors, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WhatsAppIcon } from "@/components/ui/icons";
import { setBookingStatus } from "@/app/admin/actions";
import { formatDateKey, formatIQD, formatInstantTime, formatPhone, whatsappLink } from "@/lib/format";
import { STATUS_DOT } from "@/lib/status";
import { toDateKey } from "@/lib/time";
import { useBoard } from "./BookingsBoard";
import type { Barber, BookingWithRelations } from "@/lib/types";

const isLive = (b: BookingWithRelations) => b.status === "pending" || b.status === "confirmed";

/** Ticks every 30s so countdowns and the "now" line stay current without a reload. */
function useNow(initial: number) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function relative(mins: number) {
  if (mins <= 0) return "هسه";
  if (mins < 60) return `بعد ${mins} دقيقة`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const hs = h === 1 ? "ساعة" : h === 2 ? "ساعتين" : `${h} ساعات`;
  return `بعد ${hs}${m ? ` و${m} د` : ""}`;
}

const initial = (name?: string | null) => (name ?? "؟").trim().charAt(0);

function Avatar({ name, className }: { name?: string | null; className?: string }) {
  return <span className={cn("grid shrink-0 place-items-center rounded-full bg-gold/15 font-display text-gold-light ring-1 ring-gold/30", className)}>{initial(name)}</span>;
}

// ---------------------------------------------------------------- Next up

export function NextUpCard({ bookings, tz, shopName, nowMs }: { bookings: BookingWithRelations[]; tz: string; shopName: string; nowMs: number }) {
  const { open } = useBoard();
  const now = useNow(nowMs);
  const next = bookings.find((b) => isLive(b) && new Date(b.ends_at).getTime() > now);

  if (!next) {
    return (
      <div className="flex h-full flex-col justify-center rounded-2xl border border-line-soft bg-coal/80 p-6">
        <EmptyState icon={CalendarX2} title="ما اكو مواعيد باقية اليوم" description="أي حجز جديد يطلع هنا فوراً." className="py-6" />
      </div>
    );
  }

  const start = new Date(next.starts_at).getTime();
  const inChair = start <= now;
  const mins = Math.round((start - now) / 60000);
  const phone = next.customer?.phone ?? "";
  const remind = `هلا ${next.customer?.name ?? ""}، تذكير بموعدك اليوم بـ ${shopName} الساعة ${formatInstantTime(next.starts_at, tz)}. ننتظرك 💈`;

  return (
    <div className="relative h-full overflow-hidden rounded-2xl border border-gold/35 bg-gradient-to-bl from-gold/[0.12] via-coal/80 to-coal/80 p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-xs font-medium text-gold-light">
          <span className={cn("size-2 rounded-full", inChair ? "animate-pulse bg-emerald-400" : "bg-gold")} />
          {inChair ? "بالكرسي هسه" : "الموعد الجاي"}
        </span>
        <span className="num rounded-full bg-ink/40 px-3 py-1 text-xs text-bone">{inChair ? `لحد ${formatInstantTime(next.ends_at, tz)}` : relative(mins)}</span>
      </div>

      <button onClick={() => open(next)} className="mt-5 flex w-full items-center gap-4 text-right">
        <Avatar name={next.customer?.name} className="size-14 text-2xl" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-2xl text-bone">{next.customer?.name ?? "—"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
            <span className="num inline-flex items-center gap-1"><Clock className="size-3.5" />{formatInstantTime(next.starts_at, tz)}</span>
            <span className="inline-flex items-center gap-1"><Scissors className="size-3.5" />{next.service?.name}</span>
            <span>مع {next.barber?.name}</span>
          </p>
        </div>
        <ChevronLeft className="size-5 shrink-0 text-faint" />
      </button>

      {(next.customer_note || next.customer?.notes) && (
        <p className="mt-4 line-clamp-2 rounded-xl border border-line-soft bg-ink/30 px-3 py-2 text-xs text-mute">{next.customer_note || next.customer?.notes}</p>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        {next.status === "pending" && <QuickStatus id={next.id} to="confirmed" label="تأكيد" />}
        {inChair && <QuickStatus id={next.id} to="completed" label="خلص" />}
        {phone && (
          <ButtonLink href={whatsappLink(phone, remind)} variant="outline" size="sm">
            <WhatsAppIcon className="size-4 text-emerald-400" /> تذكير
          </ButtonLink>
        )}
        {phone && (
          <ButtonLink href={`tel:+${phone}`} variant="ghost" size="sm">
            <span className="num">{formatPhone(phone)}</span>
          </ButtonLink>
        )}
      </div>
    </div>
  );
}

function QuickStatus({ id, to, label, variant = "gold" }: { id: string; to: "confirmed" | "completed" | "cancelled"; label: string; variant?: "gold" | "danger" | "subtle" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <Button
      size="sm"
      variant={variant}
      loading={pending}
      title={error ?? undefined}
      className={cn(error && "ring-1 ring-rose-400")}
      onClick={() =>
        start(async () => {
          const res = await setBookingStatus(id, to);
          if (!res.ok) return setError(res.error);
          router.refresh();
        })
      }
    >
      {to === "cancelled" ? <X className="size-4" /> : <Check className="size-4" />} {label}
    </Button>
  );
}

// ---------------------------------------------------------------- Requests inbox

export function RequestsInbox({ bookings, tz, total }: { bookings: BookingWithRelations[]; tz: string; total: number }) {
  const { open } = useBoard();
  if (bookings.length === 0) return null;
  return (
    <section className="overflow-hidden rounded-2xl border border-amber-400/30 bg-amber-400/[0.04]">
      <header className="flex items-center justify-between gap-3 border-b border-amber-400/20 px-5 py-3.5">
        <div className="flex items-center gap-2.5">
          <Bell className="size-4 text-amber-300" />
          <h2 className="font-display text-lg">تحتاج ردّك</h2>
          <span className="num rounded-full bg-amber-400 px-2 text-xs font-semibold leading-5 text-ink">{total}</span>
        </div>
        {total > bookings.length && (
          <a href="/admin/bookings?status=pending" className="text-xs text-gold hover:text-gold-light">الكل</a>
        )}
      </header>
      <ul className="divide-y divide-line-soft">
        {bookings.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
            <button onClick={() => open(b)} className="flex min-w-0 flex-1 items-center gap-3 text-right">
              <Avatar name={b.customer?.name} className="size-9 text-base" />
              <div className="min-w-0">
                <p className="truncate font-medium">{b.customer?.name ?? "—"}</p>
                <p className="num truncate text-xs text-mute">
                  {formatDateKey(toDateKey(new Date(b.starts_at), tz), { weekday: "short", day: "numeric", month: "short" })} · {formatInstantTime(b.starts_at, tz)} · {b.service?.name} · {b.barber?.name}
                </p>
              </div>
            </button>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
              <QuickStatus id={b.id} to="confirmed" label="تأكيد" />
              <QuickStatus id={b.id} to="cancelled" label="رفض" variant="danger" />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------- Today's agenda

export function TodayAgenda({ bookings, tz, nowMs }: { bookings: BookingWithRelations[]; tz: string; nowMs: number }) {
  const { open, create } = useBoard();
  const now = useNow(nowMs);
  if (bookings.length === 0)
    return (
      <EmptyState
        icon={CalendarX2}
        title="ما اكو مواعيد اليوم"
        description="الحجوزات الجديدة راح تطلع هنا أول بأول."
        action={<Button size="sm" variant="outline" onClick={() => create()}>أضف حجز</Button>}
      />
    );

  // the "now" line sits before the first booking that hasn't started yet
  const nowIdx = bookings.findIndex((b) => new Date(b.starts_at).getTime() > now);
  const rows: React.ReactNode[] = [];
  bookings.forEach((b, i) => {
    if (i === nowIdx) rows.push(<NowLine key="now" now={now} tz={tz} />);
    const past = new Date(b.ends_at).getTime() <= now;
    const faded = b.status === "cancelled" || b.status === "no_show" || (past && b.status !== "pending" && b.status !== "confirmed");
    rows.push(
      <li key={b.id}>
        <button onClick={() => open(b)} className={cn("group flex w-full items-center gap-3 px-4 py-3 text-right transition hover:bg-coal-2/60 sm:px-5", faded && "opacity-50")}>
          <div className="w-16 shrink-0">
            <p className="num font-display text-[15px] text-bone">{formatInstantTime(b.starts_at, tz)}</p>
            <p className="num text-[11px] text-faint">{b.service?.duration_minutes ? `${b.service.duration_minutes} د` : ""}</p>
          </div>
          <span className={cn("h-10 w-1 shrink-0 rounded-full", STATUS_DOT[b.status])} />
          <div className="min-w-0 flex-1">
            <p className={cn("truncate font-medium", b.status === "cancelled" && "line-through")}>{b.customer?.name ?? "—"}</p>
            <p className="mt-0.5 truncate text-xs text-mute">
              {b.service?.name} · {b.barber?.name}
            </p>
          </div>
          <p className="num hidden shrink-0 text-sm text-mute sm:block">{formatIQD(b.price_iqd)}</p>
          {isLive(b) && past ? (
            <span className="shrink-0 rounded-full bg-amber-400/10 px-2.5 py-0.5 text-xs text-amber-300 ring-1 ring-amber-400/30">سجّل النتيجة</span>
          ) : (
            <StatusBadge status={b.status} className="shrink-0" />
          )}
        </button>
      </li>,
    );
  });
  if (nowIdx === -1) rows.push(<NowLine key="now" now={now} tz={tz} />);

  return <ul className="divide-y divide-line-soft">{rows}</ul>;
}

function NowLine({ now, tz }: { now: number; tz: string }) {
  return (
    <li className="relative flex items-center gap-2 px-4 py-1 sm:px-5" aria-label="الوقت الحالي">
      <span className="num rounded-full bg-gold px-2 text-[11px] font-semibold leading-5 text-ink">{formatInstantTime(new Date(now).toISOString(), tz)}</span>
      <span className="h-px flex-1 bg-gold/60" />
    </li>
  );
}

// ---------------------------------------------------------------- Team today

export function TeamToday({ barbers, bookings, tz, nowMs, openMinutes }: { barbers: Barber[]; bookings: BookingWithRelations[]; tz: string; nowMs: number; openMinutes: number }) {
  const now = useNow(nowMs);
  const team = barbers.filter((b) => b.is_active || bookings.some((x) => x.barber_id === b.id));
  if (team.length === 0) return <EmptyState icon={CalendarX2} title="ما اكو حلاقين" description="أضف حلاق من صفحة الحلاقين." className="py-8" />;
  return (
    <ul className="divide-y divide-line-soft">
      {team.map((barber) => {
        const mine = bookings.filter((b) => b.barber_id === barber.id && (isLive(b) || b.status === "completed"));
        const booked = mine.reduce((s, b) => s + (new Date(b.ends_at).getTime() - new Date(b.starts_at).getTime()) / 60000, 0);
        const pct = openMinutes > 0 ? Math.min(100, Math.round((booked / openMinutes) * 100)) : 0;
        const busyNow = mine.find((b) => isLive(b) && new Date(b.starts_at).getTime() <= now && new Date(b.ends_at).getTime() > now);
        const next = mine.find((b) => isLive(b) && new Date(b.starts_at).getTime() > now);
        return (
          <li key={barber.id} className="flex items-center gap-3 px-5 py-3.5">
            <span className="relative">
              <Avatar name={barber.name} className="size-10 text-lg" />
              <span className={cn("absolute -bottom-0.5 -left-0.5 size-3 rounded-full ring-2 ring-coal", busyNow ? "bg-rose-400" : "bg-emerald-400")} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate font-medium">{barber.name}</p>
                <p className="num shrink-0 text-xs text-faint">{mine.length} موعد</p>
              </div>
              <p className="mt-0.5 truncate text-xs text-mute">
                {busyNow ? `مشغول لحد ${formatInstantTime(busyNow.ends_at, tz)}` : next ? `فاضي · الجاي ${formatInstantTime(next.starts_at, tz)}` : "فاضي لباقي اليوم"}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-coal-3">
                <div className="h-full rounded-full bg-gradient-to-l from-gold-light to-gold-deep" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <span className="num w-10 shrink-0 text-left text-xs text-mute">{pct}%</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------------------------------------------------------------- Day progress

export function DayProgress({ earned, expected, done, total, occupancy }: { earned: number; expected: number; done: number; total: number; occupancy: number }) {
  const pct = expected > 0 ? Math.round((earned / expected) * 100) : 0;
  return (
    <div className="flex h-full flex-col rounded-2xl border border-line-soft bg-coal/80 p-5 sm:p-6">
      <p className="text-xs text-mute">دخل اليوم</p>
      <p className="num mt-2 font-display text-3xl text-bone">{formatIQD(earned)}</p>
      <p className="num mt-1 text-xs text-faint">من {formatIQD(expected)} متوقع</p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-coal-3">
        <div className="h-full rounded-full bg-gradient-to-l from-gold-light to-gold-deep transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <dl className="mt-auto grid grid-cols-2 gap-3 pt-5 text-sm">
        <div className="rounded-xl bg-coal-2/60 px-3 py-2.5">
          <dt className="text-[11px] text-faint">خلصت</dt>
          <dd className="num mt-0.5 text-bone">{done} / {total}</dd>
        </div>
        <div className="rounded-xl bg-coal-2/60 px-3 py-2.5">
          <dt className="text-[11px] text-faint">الإشغال</dt>
          <dd className="num mt-0.5 text-bone">{occupancy}%</dd>
        </div>
      </dl>
    </div>
  );
}
