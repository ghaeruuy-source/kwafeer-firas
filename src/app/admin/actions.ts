"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/shop";
import { createClient } from "@/lib/supabase/server";
import { toArabicError } from "@/lib/errors";
import { addDays, zonedToUtc } from "@/lib/time";
import {
  adminBookingSchema,
  barberSchema,
  blockedTimeSchema,
  customerNotesSchema,
  firstError,
  serviceSchema,
  shopSettingsSchema,
  statusSchema,
  uuid,
  workingDaySchema,
  loyaltySettingsSchema,
} from "@/lib/validation";
import type { ActionResult } from "@/lib/types";
import { z } from "zod";

const refresh = () => revalidatePath("/admin", "layout");

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

// ---------------- Bookings ----------------

export async function setBookingStatus(id: string, status: string): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const p = z.object({ id: uuid, status: statusSchema }).safeParse({ id, status });
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const { error } = await supabase.rpc("admin_set_booking_status", { p_booking_id: p.data.id, p_status: p.data.status });
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  return { ok: true };
}

export async function saveBooking(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = adminBookingSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const b = p.data;
  const startsAt = zonedToUtc(b.date, b.time, shop.timezone).toISOString();

  if (b.id) {
    // Name/phone edits belong to the customer record
    const { data: existing, error: e1 } = await supabase.from("bookings").select("customer_id").eq("id", b.id).single();
    if (e1) return { ok: false, error: toArabicError(e1) };
    const { error: e2 } = await supabase.rpc("admin_update_booking", {
      p_booking_id: b.id,
      p_service_id: b.service_id,
      p_barber_id: b.barber_id,
      p_starts_at: startsAt,
      p_status: b.status,
      p_admin_note: b.admin_note,
    });
    if (e2) return { ok: false, error: toArabicError(e2) };
    const { error: e3 } = await supabase.from("customers").update({ name: b.name }).eq("id", existing.customer_id);
    if (e3) return { ok: false, error: toArabicError(e3) };
  } else {
    if (b.status !== "pending" && b.status !== "confirmed") return { ok: false, error: "الحجز الجديد يكون مؤكد أو بانتظار التأكيد" };
    const { error } = await supabase.rpc("admin_create_booking", {
      p_shop_id: shop.id,
      p_service_id: b.service_id,
      p_barber_id: b.barber_id,
      p_starts_at: startsAt,
      p_name: b.name,
      p_phone: b.phone,
      p_status: b.status,
      p_admin_note: b.admin_note,
    });
    if (error) return { ok: false, error: toArabicError(error) };
  }
  refresh();
  return { ok: true };
}

// ---------------- Services ----------------

export async function saveService(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = serviceSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const { id, ...fields } = p.data;
  const q = id
    ? supabase.from("services").update(fields).eq("id", id).eq("shop_id", shop.id)
    : supabase.from("services").insert({ ...fields, shop_id: shop.id });
  const { error } = await q;
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  revalidatePath("/");
  return { ok: true };
}

export async function deleteService(id: string): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "معرّف غير صالح" };
  const { error } = await supabase.from("services").delete().eq("id", id).eq("shop_id", shop.id);
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  revalidatePath("/");
  return { ok: true };
}

// ---------------- Barbers ----------------

export async function saveBarber(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = barberSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const { id, ...fields } = p.data;
  const q = id
    ? supabase.from("barbers").update(fields).eq("id", id).eq("shop_id", shop.id)
    : supabase.from("barbers").insert({ ...fields, shop_id: shop.id });
  const { error } = await q;
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  revalidatePath("/");
  return { ok: true };
}

export async function deleteBarber(id: string): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "معرّف غير صالح" };
  const { error } = await supabase.from("barbers").delete().eq("id", id).eq("shop_id", shop.id);
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  revalidatePath("/");
  return { ok: true };
}

// ---------------- Working hours & blocked times ----------------

export async function saveWorkingHours(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = z.array(workingDaySchema).length(7).safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const rows = p.data.map((d) => ({ ...d, shop_id: shop.id }));
  const { error } = await supabase.from("working_hours").upsert(rows, { onConflict: "shop_id,weekday" });
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  revalidatePath("/");
  return { ok: true };
}

export async function addBlockedTime(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = blockedTimeSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const d = p.data;
  const starts = d.all_day ? zonedToUtc(d.start_date, "00:00", shop.timezone) : zonedToUtc(d.start_date, d.start_time!, shop.timezone);
  const ends = d.all_day ? zonedToUtc(addDays(d.end_date, 1), "00:00", shop.timezone) : zonedToUtc(d.end_date, d.end_time!, shop.timezone);
  if (ends <= starts) return { ok: false, error: "وقت النهاية لازم يكون بعد البداية" };
  const { error } = await supabase.from("blocked_times").insert({
    shop_id: shop.id,
    barber_id: d.barber_id,
    starts_at: starts.toISOString(),
    ends_at: ends.toISOString(),
    reason: d.reason,
  });
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  return { ok: true };
}

export async function deleteBlockedTime(id: string): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "معرّف غير صالح" };
  const { error } = await supabase.from("blocked_times").delete().eq("id", id).eq("shop_id", shop.id);
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  return { ok: true };
}

// ---------------- Customers ----------------

export async function saveCustomer(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = customerNotesSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const { error } = await supabase.from("customers").update({ name: p.data.name, notes: p.data.notes }).eq("id", p.data.id).eq("shop_id", shop.id);
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  return { ok: true };
}

// ---------------- Loyalty card ----------------

export async function saveLoyaltySettings(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = loyaltySettingsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const { error } = await supabase.from("shops").update(p.data).eq("id", shop.id);
  if (error) {
    if (/loyalty_/.test(error.message)) return { ok: false, error: "لازم تشغل كود SQL مال بطاقة الولاء بـ Supabase أول مرة، بعدها تكدر تحفظ." };
    return { ok: false, error: toArabicError(error) };
  }
  refresh();
  return { ok: true };
}

// ---------------- Shop settings ----------------

export async function saveShopSettings(input: unknown): Promise<ActionResult> {
  const { supabase, shop } = await requireAdmin();
  const p = shopSettingsSchema.safeParse(input);
  if (!p.success) return { ok: false, error: firstError(p.error) };
  const { error } = await supabase.from("shops").update(p.data).eq("id", shop.id);
  if (error) return { ok: false, error: toArabicError(error) };
  refresh();
  revalidatePath("/");
  return { ok: true };
}
