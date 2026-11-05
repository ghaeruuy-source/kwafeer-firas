import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { clientIp, rateLimited } from "@/lib/api";
import { renderReceipt } from "@/lib/receipt";
import { lookupSchema } from "@/lib/validation";
import type { PublicBooking } from "@/lib/types";

export const runtime = "nodejs";

/** The customer's copy: /api/booking-receipt?code=ABC123&phone=0770… (same proof as "حجوزاتي"). */
export async function GET(req: Request) {
  if (rateLimited(`receipt:${clientIp(req)}`, 30, 10 * 60_000)) return new Response("Too many requests", { status: 429 });
  const q = new URL(req.url).searchParams;
  const parsed = lookupSchema.safeParse({ code: q.get("code") ?? "", phone: q.get("phone") ?? "" });
  if (!parsed.success) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_public", { p_code: parsed.data.code, p_phone: parsed.data.phone });
  if (error || !data) return new Response("Not found", { status: 404 });
  const b = data as PublicBooking;
  const { data: shop } = await supabase.from("shops").select("name,timezone").eq("slug", env.shopSlug).maybeSingle();

  const png = await renderReceipt({
    copy: "customer",
    code: b.code,
    status: b.status,
    starts_at: b.starts_at,
    price_iqd: b.price_iqd,
    customer_name: b.customer_name,
    service_name: b.service_name,
    barber_name: b.barber_name,
    customer_note: b.customer_note,
    duration_minutes: Math.round((Date.parse(b.ends_at) - Date.parse(b.starts_at)) / 60_000),
    shop_name: shop?.name,
    timezone: shop?.timezone,
  });
  const download = q.get("download") === "1";
  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=60",
      ...(download ? { "Content-Disposition": `attachment; filename="wasl-${b.code}.png"` } : {}),
    },
  });
}
