import { z } from "zod";
import { normalizeIraqiPhone, toLatinDigits } from "./format";
import { ALL_STATUSES } from "./status";
import type { BookingStatus } from "./types";

const trimmed = (min: number, max: number, message: string) =>
  z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(min, message).max(max, message));

const optionalText = (max: number) =>
  z
    .string()
    .max(max, `النص لازم يكون أقل من ${max} حرف`)
    .optional()
    .nullable()
    .transform((s) => (s && s.trim() ? s.trim() : null));

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const p = normalizeIraqiPhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "رقم الموبايل غير صحيح. اكتبه مثل 07701234567" });
      return z.NEVER;
    }
    return p;
  });

export const optionalPhoneSchema = z
  .string()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const p = normalizeIraqiPhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "رقم الموبايل غير صحيح" });
      return z.NEVER;
    }
    return p;
  });

export const uuid = z.uuid("معرّف غير صالح");
export const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "تاريخ غير صالح");
export const timeKey = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "وقت غير صالح");
export const statusSchema = z.enum(ALL_STATUSES as [BookingStatus, ...BookingStatus[]]);

const intFrom = (min: number, max: number, message: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? Number(toLatinDigits(v).replace(/[,\s]/g, "")) : v),
    z.number(message).int(message).min(min, message).max(max, message),
  );

// ---- Public booking -------------------------------------------------------
export const slotsQuerySchema = z.object({
  service: uuid,
  date: dateKey,
  barber: uuid.optional().nullable(),
});

export const createBookingSchema = z.object({
  serviceId: uuid,
  barberId: uuid.nullable(),
  startsAt: z.iso.datetime({ offset: true, message: "وقت غير صالح" }),
  name: trimmed(2, 60, "اكتب اسمك (حرفين على الأقل)"),
  phone: phoneSchema,
  note: optionalText(300),
});

export const lookupSchema = z.object({
  code: z
    .string()
    .transform((s) => toLatinDigits(s).trim().toUpperCase())
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "رمز الحجز يتكون من 6 حروف وأرقام")),
  phone: phoneSchema,
});

// ---- Admin ----------------------------------------------------------------
export const serviceSchema = z.object({
  id: uuid.optional(),
  name: trimmed(2, 80, "اسم الخدمة بين 2 و80 حرف"),
  description: optionalText(300),
  price_iqd: intFrom(0, 10_000_000, "السعر غير صالح"),
  duration_minutes: intFrom(5, 480, "المدة بين 5 و480 دقيقة"),
  is_active: z.boolean(),
  sort_order: intFrom(0, 999, "الترتيب غير صالح"),
});

export const barberSchema = z.object({
  id: uuid.optional(),
  name: trimmed(2, 60, "الاسم بين 2 و60 حرف"),
  title: optionalText(60),
  photo_url: optionalText(500).refine((v) => !v || /^https?:\/\//.test(v), "رابط الصورة لازم يبدي بـ https://"),
  is_active: z.boolean(),
  sort_order: intFrom(0, 999, "الترتيب غير صالح"),
});

// Closing at midnight is entered as 00:00 and stored as 24:00 so the day still ends after it starts.
const closeKey = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "وقت غير صالح").transform((v) => (v === "00:00" ? "24:00" : v));

export const workingDaySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    is_open: z.boolean(),
    open_time: timeKey,
    close_time: closeKey,
    break_start: timeKey.nullable(),
    break_end: timeKey.nullable(),
  })
  .refine((d) => d.open_time < d.close_time, { message: "وقت الفتح لازم يكون قبل وقت السد" })
  .refine((d) => (d.break_start === null) === (d.break_end === null), { message: "حدد بداية ونهاية الاستراحة" })
  .refine(
    (d) => !d.break_start || !d.break_end || (d.break_start < d.break_end && d.break_start >= d.open_time && d.break_end <= d.close_time),
    { message: "الاستراحة لازم تكون داخل وقت الدوام" },
  );

export const blockedTimeSchema = z
  .object({
    barber_id: uuid.nullable(),
    start_date: dateKey,
    end_date: dateKey,
    all_day: z.boolean(),
    start_time: timeKey.optional(),
    end_time: timeKey.optional(),
    reason: optionalText(120),
  })
  .refine((d) => d.end_date >= d.start_date, { message: "تاريخ النهاية لازم يكون بعد البداية" })
  .refine((d) => d.all_day || (d.start_time && d.end_time), { message: "حدد وقت البداية والنهاية" });

export const shopSettingsSchema = z.object({
  name: trimmed(2, 80, "اسم الصالون بين 2 و80 حرف"),
  tagline: optionalText(160),
  about: optionalText(1000),
  logo_url: optionalText(500),
  cover_url: optionalText(500),
  phone: optionalPhoneSchema,
  whatsapp: optionalPhoneSchema,
  instagram: optionalText(60).transform((v) => (v ? v.replace(/^@/, "") : v)),
  address: optionalText(200),
  maps_url: optionalText(500),
  slot_interval_minutes: intFrom(5, 60, "مدة الفترة غير صالحة").refine((n) => [5, 10, 15, 20, 30, 60].includes(n), "مدة الفترة غير صالحة"),
  booking_window_days: intFrom(1, 180, "مدة الحجز المسبق بين 1 و180 يوم"),
  min_notice_minutes: intFrom(0, 1440, "أقل مدة قبل الموعد بين 0 و1440 دقيقة"),
  max_active_per_customer: intFrom(1, 10, "عدد الحجوزات لكل زبون بين 1 و10"),
  auto_confirm: z.boolean(),
  sequential_slots: z.boolean(),
});

export const adminBookingSchema = z.object({
  id: uuid.optional(),
  service_id: uuid,
  barber_id: uuid,
  date: dateKey,
  time: timeKey,
  status: statusSchema,
  name: trimmed(2, 60, "اكتب اسم الزبون"),
  phone: phoneSchema,
  admin_note: optionalText(500),
});

export const customerNotesSchema = z.object({
  id: uuid,
  name: trimmed(2, 60, "الاسم بين 2 و60 حرف"),
  notes: optionalText(1000),
});

export function firstError(error: z.ZodError): string {
  return error.issues[0]?.message ?? "البيانات غير صحيحة";
}
