"use client";

import { CalendarX2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDateKey, formatIQD, formatInstantTime, formatPhone } from "@/lib/format";
import { STATUS_DOT } from "@/lib/status";
import { toDateKey } from "@/lib/time";
import { useBoard } from "./BookingsBoard";
import type { BookingWithRelations } from "@/lib/types";

export function BookingList({
  bookings,
  tz,
  showDate,
  emptyTitle = "ما اكو حجوزات",
  emptyDescription,
}: {
  bookings: BookingWithRelations[];
  tz: string;
  showDate?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const { open } = useBoard();
  if (bookings.length === 0) return <EmptyState icon={CalendarX2} title={emptyTitle} description={emptyDescription} />;

  return (
    <ul className="divide-y divide-line-soft">
      {bookings.map((b) => {
        const faded = b.status === "cancelled" || b.status === "no_show";
        return (
          <li key={b.id}>
            <button onClick={() => open(b)} className={cn("flex w-full items-center gap-4 px-4 py-3.5 text-right transition hover:bg-coal-2/60 sm:px-5", faded && "opacity-55")}>
              <div className="w-16 shrink-0 text-center">
                <p className="num font-display text-[15px] text-bone">{formatInstantTime(b.starts_at, tz)}</p>
                {showDate && <p className="mt-0.5 text-[11px] text-faint">{formatDateKey(toDateKey(new Date(b.starts_at), tz), { day: "numeric", month: "short" })}</p>}
              </div>
              <span className={cn("h-10 w-0.5 shrink-0 rounded-full", STATUS_DOT[b.status])} />
              <div className="min-w-0 flex-1">
                <p className={cn("truncate font-medium", b.status === "cancelled" && "line-through")}>{b.customer?.name ?? "—"}</p>
                <p className="mt-0.5 truncate text-xs text-mute">
                  {b.service?.name} · {b.barber?.name}
                  <span className="num mr-2 hidden text-faint sm:inline">{formatPhone(b.customer?.phone)}</span>
                </p>
              </div>
              <div className="hidden shrink-0 text-left sm:block">
                <p className="num text-sm text-mute">{formatIQD(b.price_iqd)}</p>
              </div>
              <StatusBadge status={b.status} className="shrink-0" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
