import { formatIQD, formatInstantDate, formatInstantTime, formatPhonePlain } from "@/lib/format";

/** Full booking details for the customer's WhatsApp message to the barber, so he sees everything at a glance. */
export function bookingWhatsappText(b: {
  barberName?: string | null;
  customerName?: string | null;
  phone?: string | null;
  serviceName: string;
  startsAt: string;
  timezone: string;
  priceIqd: number;
  code: string;
  note?: string | null;
  receiptUrl?: string | null;
}): string {
  const lines = [
    `هلو${b.barberName ? ` ${b.barberName}` : ""} 👋 حجزت عندك:`,
    "",
    `✂️ الخدمة: ${b.serviceName}`,
    `📅 اليوم: ${formatInstantDate(b.startsAt, b.timezone)}`,
    `🕒 الساعة: ${formatInstantTime(b.startsAt, b.timezone)}`,
    `💰 السعر: ${formatIQD(b.priceIqd)}`,
  ];
  if (b.customerName) lines.push(`👤 الاسم: ${b.customerName}`);
  if (b.phone) lines.push(`📞 الرقم: ${formatPhonePlain(b.phone)}`);
  if (b.note) lines.push(`📝 ملاحظة: ${b.note}`);
  lines.push(`🔖 رمز الحجز: ${b.code}`);
  if (b.receiptUrl) lines.push("", `🧾 الوصل: ${b.receiptUrl}`);
  return lines.join("\n");
}

/** Absolute link to the customer's receipt picture (works from WhatsApp too). */
export function receiptLink(code: string, phone: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/api/booking-receipt?code=${encodeURIComponent(code)}&phone=${encodeURIComponent(phone)}`;
}
