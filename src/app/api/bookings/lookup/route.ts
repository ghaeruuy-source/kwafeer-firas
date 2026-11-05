import { createClient } from "@/lib/supabase/server";
import { clientIp, fail, json, rateLimited } from "@/lib/api";
import { toArabicError } from "@/lib/errors";
import { firstError, lookupSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (rateLimited(`lookup:${clientIp(req)}`, 20, 10 * 60_000)) {
    return fail("محاولات كثيرة. انتظر شوية وحاول مرة ثانية.", 429);
  }
  const parsed = lookupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(firstError(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_public", { p_code: parsed.data.code, p_phone: parsed.data.phone });
  if (error) return fail(toArabicError(error));
  if (!data) return fail(toArabicError("BOOKING_NOT_FOUND"), 404);
  // Loyalty card progress; null until the loyalty SQL is run or when the shop switched it off.
  const { data: loyalty } = await supabase.rpc("get_loyalty_public", { p_code: parsed.data.code, p_phone: parsed.data.phone });
  return json({ booking: data, loyalty: loyalty ?? null });
}
