import type { BookingStatus } from "./types";

export const STATUS_LABEL: Record<BookingStatus, string> = {
  pending: "بانتظار التأكيد",
  confirmed: "مؤكد",
  completed: "مكتمل",
  cancelled: "ملغي",
  no_show: "ما حضر",
};

export const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-amber-400/10 text-amber-300 ring-amber-400/30",
  confirmed: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30",
  completed: "bg-sky-400/10 text-sky-300 ring-sky-400/30",
  cancelled: "bg-zinc-400/10 text-zinc-400 ring-zinc-400/25",
  no_show: "bg-rose-400/10 text-rose-300 ring-rose-400/30",
};

export const STATUS_DOT: Record<BookingStatus, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-400",
  completed: "bg-sky-400",
  cancelled: "bg-zinc-500",
  no_show: "bg-rose-400",
};

export const ACTIVE_STATUSES: BookingStatus[] = ["pending", "confirmed"];
export const ALL_STATUSES: BookingStatus[] = ["pending", "confirmed", "completed", "cancelled", "no_show"];
