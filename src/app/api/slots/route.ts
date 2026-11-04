import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { fail, json } from "@/lib/api";
import { toArabicError } from "@/lib/errors";
import { firstError, slotsQuerySchema } from "@/lib/validation";
import type { Slot } from "@/lib/types";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = slotsQuerySchema.safeParse({
    service: url.searchParams.get("service"),
    date: url.searchParams.get("date"),
    barber: url.searchParams.get("barber") || null,
  });
  if (!parsed.success) return fail(firstError(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_slots", {
    p_shop_slug: env.shopSlug,
    p_service_id: parsed.data.service,
    p_date: parsed.data.date,
    p_barber_id: parsed.data.barber ?? null,
  });
  if (error) return fail(toArabicError(error), 400);
  return json({ slots: (data ?? []) as Slot[] });
}
