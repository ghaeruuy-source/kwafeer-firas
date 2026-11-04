import { createClient } from "@/lib/supabase/server";
import { clientIp, fail, json, rateLimited } from "@/lib/api";
import { toArabicError } from "@/lib/errors";
import { firstError, lookupSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (rateLimited(`cancel:${clientIp(req)}`, 10, 10 * 60_000)) {
    return fail("محاولات كثيرة. انتظر شوية وحاول مرة ثانية.", 429);
  }
  const parsed = lookupSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(firstError(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_booking_public", { p_code: parsed.data.code, p_phone: parsed.data.phone });
  if (error) return fail(toArabicError(error));
  return json({ booking: data });
}
