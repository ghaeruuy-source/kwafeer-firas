const MESSAGES: Record<string, string> = {
  SHOP_NOT_FOUND: "الصالون غير موجود. تأكد من الإعدادات.",
  SERVICE_UNAVAILABLE: "هاي الخدمة غير متوفرة حالياً.",
  BARBER_UNAVAILABLE: "الحلاق المختار غير متوفر.",
  SLOT_TAKEN: "هذا الوقت انحجز قبل شوية. اختار وقت ثاني.",
  DUPLICATE_BOOKING: "عندك حجز بنفس هذا الوقت.",
  TOO_MANY_BOOKINGS: "عندك حجوزات قادمة كافية. ألغِ واحد أو انتظر موعدك.",
  OUTSIDE_HOURS: "هذا الوقت خارج أوقات الدوام.",
  DURING_BREAK: "هذا الوقت ضمن وقت الاستراحة.",
  BLOCKED_TIME: "الصالون مسكّر بهذا الوقت.",
  TOO_SOON: "هذا الوقت قريب كلش. اختار وقت أبعد.",
  TOO_FAR: "ما تكدر تحجز لهذا التاريخ البعيد.",
  INVALID_TIME: "الوقت غير صالح.",
  INVALID_PHONE: "رقم الموبايل غير صحيح. اكتبه مثل 07701234567",
  INVALID_NAME: "اكتب اسمك (حرفين على الأقل).",
  INVALID_NOTE: "الملاحظة طويلة.",
  INVALID_STATUS: "الحالة غير صالحة.",
  BOOKING_NOT_FOUND: "ما لكينا الحجز. تأكد من الرمز ورقم الموبايل.",
  CANNOT_CANCEL: "ما يصير تلغي هذا الحجز. الإلغاء متاح قبل الموعد بساعة على الأقل.",
  FORBIDDEN: "ما عندك صلاحية لهذا الإجراء.",
};

/** Maps a Postgres/PostgREST error (our raised codes) to an Arabic message. */
export function toArabicError(error: unknown): string {
  const raw =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error
        ? String((error as { message: unknown }).message)
        : "";
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code];
  }
  if (raw.includes("bookings_no_overlap")) return MESSAGES.SLOT_TAKEN;
  if (raw.includes("violates foreign key") || raw.includes("23503")) return "ما يصير تحذف هذا العنصر لأن عليه حجوزات. عطّله بدل الحذف.";
  if (raw.includes("check constraint")) return "بعض القيم غير صحيحة. راجع الحقول.";
  if (raw.includes("duplicate key")) return "هذا العنصر موجود من قبل.";
  return "صار خطأ غير متوقع. حاول مرة ثانية.";
}
