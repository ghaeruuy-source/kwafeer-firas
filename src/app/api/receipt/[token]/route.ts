import { createClient } from "@/lib/supabase/server";
import { renderReceipt } from "@/lib/receipt";
import type { BookingStatus } from "@/lib/types";

export const runtime = "nodejs";

interface ReceiptRow {
  code: string;
  status: BookingStatus;
  starts_at: string;
  created_at: string;
  price_iqd: number;
  customer_name: string;
  customer_phone: string;
  customer_note: string | null;
  service_name: string;
  duration_minutes: number;
  barber_name: string;
  shop_name: string;
  timezone: string;
  visit_number: number;
}

/** The barber's copy of a booking receipt. The token is a secret only the barber's message carries. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{32}$/.test(token)) return new Response("Not found", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booking_receipt", { p_token: token });
  if (error || !data) return new Response("Not found", { status: 404 });
  const r = data as ReceiptRow;

  const png = await renderReceipt({ ...r, copy: "barber", issued_at: r.created_at });
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "private, max-age=60" },
  });
}
