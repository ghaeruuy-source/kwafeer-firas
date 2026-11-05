import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, fail, json, rateLimited } from "@/lib/api";
import { toArabicError } from "@/lib/errors";
import { firstError, waitlistSchema } from "@/lib/validation";

export async function POST(req: Request) {
  if (rateLimited(`vip:${clientIp(req)}`, 6, 10 * 60_000)) {
    return fail("محاولات كثيرة. انتظر شوية وحاول مرة ثانية.", 429);
  }
  const parsed = waitlistSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail(firstError(parsed.error));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_waitlist", {
    p_shop_slug: env.shopSlug,
    p_day: parsed.data.date,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
  });
  if (error) return fail(toArabicError(error));
  return json(data as { position: number });
}
