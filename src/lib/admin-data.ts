import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BOOKING_SELECT, type Barber, type BookingWithRelations, type Service } from "./types";
import { zonedToUtc, addDays } from "./time";

export async function getCatalog(supabase: SupabaseClient, shopId: string) {
  const [services, barbers] = await Promise.all([
    supabase.from("services").select("*").eq("shop_id", shopId).order("sort_order").order("name"),
    supabase.from("barbers").select("*").eq("shop_id", shopId).order("sort_order").order("name"),
  ]);
  if (services.error) throw new Error(services.error.message);
  if (barbers.error) throw new Error(barbers.error.message);
  return { services: (services.data ?? []) as Service[], barbers: (barbers.data ?? []) as Barber[] };
}

/** Bookings whose start falls within [fromKey, toKey] local dates. */
export async function getBookingsInRange(supabase: SupabaseClient, shopId: string, tz: string, fromKey: string, toKey: string) {
  const { data, error } = await supabase
    .from("bookings")
    .select(BOOKING_SELECT)
    .eq("shop_id", shopId)
    .gte("starts_at", zonedToUtc(fromKey, "00:00", tz).toISOString())
    .lt("starts_at", zonedToUtc(addDays(toKey, 1), "00:00", tz).toISOString())
    .order("starts_at");
  if (error) throw new Error(error.message);
  return (data ?? []) as BookingWithRelations[];
}
