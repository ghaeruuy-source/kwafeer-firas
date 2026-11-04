import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, fail, json, rateLimited } from "@/lib/api";
import { toArabicError } from "@/lib/errors";
import { createBookingSchema, firstError } from "@/lib/validation";

export async function POST(req: Request) {
  if (rateLimited(`book:${clientIp(req)}`, 8, 10 * 60_000)) {
    return fail("محاولات كثيرة. انتظر شوية وحاول مرة ثانية.", 429);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return fail("طلب غير صالح");
  }
  const parsed = createBookingSchema.safeParse(body);
  if (!parsed.success) return fail(firstError(parsed.error));
  const b = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_booking", {
    p_shop_slug: env.shopSlug,
    p_service_id: b.serviceId,
    p_barber_id: b.barberId,
    p_starts_at: b.startsAt,
    p_name: b.name,
    p_phone: b.phone,
    p_note: b.note,
  });
  if (error) {
    const status = error.message.includes("SLOT_TAKEN") ? 409 : 400;
    return fail(toArabicError(error), status);
  }
  return json({ booking: data, phone: b.phone }, 201);
}
