import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Telegram bot webhook. A barber opens his link from the admin "الحلاقين" page, which sends
 * "/start <link_token>"; that links his chat so booking receipts reach him as pictures.
 * Replies are returned in the webhook response, so the bot token never touches the site.
 */
export async function POST(req: Request) {
  const secret = req.headers.get("x-telegram-bot-api-secret-token");
  if (!secret) return new Response("Forbidden", { status: 403 });

  const update = (await req.json().catch(() => null)) as {
    message?: { text?: string; chat?: { id: number; first_name?: string; username?: string } };
  } | null;
  const msg = update?.message;
  const chatId = msg?.chat?.id;
  if (!msg || !chatId) return new Response("ok");

  const reply = (text: string) => Response.json({ method: "sendMessage", chat_id: chatId, text });
  const m = msg.text?.trim().match(/^\/start\s+([0-9a-f]{24})$/);
  if (!m) return reply("هلا بيك 👋 هذا بوت الحجوزات. حتى توصلك وصولات الحجز، افتح الرابط الخاص بيك من لوحة التحكم ← الحلاقين.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("telegram_link_barber", {
    p_secret: secret,
    p_link_token: m[1],
    p_chat_id: chatId,
    p_name: msg.chat?.first_name || msg.chat?.username || "",
  });
  if (error) return new Response("Forbidden", { status: 403 });
  if (!data) return reply("الرابط مو صحيح أو قديم. خذ الرابط من جديد من لوحة التحكم ← الحلاقين.");
  return reply(`تم ✅ هسه كل حجز جديد عند ${data} يوصلك هنا كصورة وصل.`);
}
