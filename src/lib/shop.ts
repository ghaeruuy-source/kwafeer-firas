import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import type { Barber, Service, Shop, Slot, WorkingHours } from "@/lib/types";
import { addDays, todayKey, weekdayOf } from "@/lib/time";

export interface Storefront {
  shop: Shop;
  services: Service[];
  barbers: Barber[];
  hours: WorkingHours[];
}

/** Public storefront data (anon RLS: active services/barbers only). */
export const getStorefront = cache(async (): Promise<Storefront | null> => {
  const supabase = await createClient();
  const { data: shop, error } = await supabase.from("shops").select("*").eq("slug", env.shopSlug).maybeSingle();
  if (error) throw new Error(error.message);
  if (!shop) return null;

  const [services, barbers, hours] = await Promise.all([
    supabase.from("services").select("*").eq("shop_id", shop.id).eq("is_active", true).order("sort_order").order("name"),
    supabase.from("barbers").select("*").eq("shop_id", shop.id).eq("is_active", true).order("sort_order").order("name"),
    supabase.from("working_hours").select("*").eq("shop_id", shop.id).order("weekday"),
  ]);
  for (const r of [services, barbers, hours]) if (r.error) throw new Error(r.error.message);

  return {
    shop: shop as Shop,
    services: (services.data ?? []) as Service[],
    barbers: (barbers.data ?? []) as Barber[],
    hours: (hours.data ?? []) as WorkingHours[],
  };
});

/** Admin context: signed-in user who is an admin of this deployment's shop. */
export const getAdminContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/admin/login");

  const { data: shop } = await supabase.from("shops").select("*").eq("slug", env.shopSlug).maybeSingle();
  if (!shop) return { supabase, user, shop: null, isAdmin: false as const };

  const { data: membership } = await supabase
    .from("shop_admins")
    .select("shop_id")
    .eq("shop_id", shop.id)
    .eq("user_id", user.id)
    .maybeSingle();

  return { supabase, user, shop: shop as Shop, isAdmin: Boolean(membership) };
});

/** Use inside admin pages/actions: guarantees an admin + shop or redirects. */
export async function requireAdmin() {
  const ctx = await getAdminContext();
  if (!ctx.shop || !ctx.isAdmin) redirect("/admin/no-access");
  return ctx as typeof ctx & { shop: Shop; isAdmin: true };
}

/** First bookable time in the next two weeks (shortest service), for the home page pill. */
export async function getNextFreeSlot(sf: Storefront): Promise<{ date: string; at: string } | null> {
  const ref = [...sf.services].sort((a, b) => a.duration_minutes - b.duration_minutes)[0];
  if (!ref) return null;
  const supabase = await createClient();
  const today = todayKey(sf.shop.timezone);
  const span = Math.min(14, sf.shop.booking_window_days);
  for (let i = 0; i <= span; i++) {
    const date = addDays(today, i);
    if (!sf.hours.find((h) => h.weekday === weekdayOf(date))?.is_open) continue;
    const { data, error } = await supabase.rpc("get_available_slots", {
      p_shop_slug: env.shopSlug, p_service_id: ref.id, p_date: date, p_barber_id: null,
    });
    if (error) return null;
    const hit = ((data ?? []) as Slot[]).find((s) => s.available);
    if (hit) return { date, at: hit.slot_start };
  }
  return null;
}
