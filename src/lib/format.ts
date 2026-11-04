import { SHOP_TZ } from "./time";

const LOCALE = "ar-IQ-u-nu-latn";

export function formatIQD(amount: number): string {
  return `${new Intl.NumberFormat("en-US").format(amount)} د.ع`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} دقيقة`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hours = h === 1 ? "ساعة" : h === 2 ? "ساعتين" : `${h} ساعات`;
  return m ? `${hours} و${m} دقيقة` : hours;
}

/** 14:30 -> "2:30 م" */
export function formatTime12(time: string): string {
  const [h, m] = time.split(":").map(Number);
  if (h === 24 || (h === 0 && m === 0)) return "12:00 بالليل";
  const suffix = h < 12 ? "ص" : "م";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatInstantTime(iso: string, tz = SHOP_TZ): string {
  const d = new Date(iso);
  const t = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(d);
  return formatTime12(t);
}

export function formatInstantDate(iso: string, tz = SHOP_TZ, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: tz,
    weekday: "long",
    day: "numeric",
    month: "long",
    ...opts,
  }).format(new Date(iso));
}

/** "2026-11-05" -> "الخميس 5 تشرين الثاني" (date key is already local) */
export function formatDateKey(dateKey: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(LOCALE, { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** Converts Arabic-Indic / Persian digits to Latin. */
export function toLatinDigits(input: string): string {
  return input
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 0x06f0));
}

/** Mirrors public.normalize_iq_phone in SQL. Returns 9647XXXXXXXXX or null. */
export function normalizeIraqiPhone(input: string): string | null {
  let d = toLatinDigits(input).replace(/\D/g, "");
  if (d.startsWith("00964")) d = d.slice(2);
  if (d.startsWith("9640")) d = "964" + d.slice(4);
  if (d.startsWith("07") && d.length === 11) d = "964" + d.slice(1);
  if (d.startsWith("7") && d.length === 10) d = "964" + d;
  return /^9647\d{9}$/.test(d) ? d : null;
}

/** 9647701234567 -> "0770 123 4567" without bidi marks (for inputs and message text). */
export function formatPhonePlain(phone: string | null | undefined): string {
  return formatPhone(phone).replace(/[\u2066\u2069]/g, "");
}

/** 9647701234567 -> "0770 123 4567" */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const local = phone.startsWith("964") ? "0" + phone.slice(3) : phone;
  // LRI…PDI keeps the digit groups in order inside right-to-left text
  return `\u2066${local.replace(/^(\d{4})(\d{3})(\d{4})$/, "$1 $2 $3")}\u2069`;
}

export function whatsappLink(phone: string, text?: string): string {
  const base = `https://wa.me/${phone}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}
