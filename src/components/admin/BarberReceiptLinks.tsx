"use client";

import { useState } from "react";
import { Check, Copy, Send } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { barberWhatsapp } from "@/components/booking/BarberPicker";
import { whatsappLink } from "@/lib/format";
import type { Barber } from "@/lib/types";

export interface BarberNotify {
  barber_id: string;
  telegram_link: string | null;
  telegram_linked: boolean;
  telegram_name: string | null;
  whatsapp_on: boolean;
}

/** Shows which barbers get the booking receipt picture, and the one-time link each barber opens. */
export function BarberReceiptLinks({ barbers, notify, shopWhatsapp }: { barbers: Barber[]; notify: BarberNotify[]; shopWhatsapp: string | null }) {
  const [copied, setCopied] = useState<string | null>(null);
  const byId = new Map(notify.map((n) => [n.barber_id, n]));
  const ready = notify.some((n) => n.telegram_link);

  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display text-xl">وصل الحجز للحلاق</h2>
      <p className="mt-1 text-sm text-mute">
        كل حجز جديد يوصل للحلاق اللي انحجز عنده كصورة وصل على التيليغرام. كل حلاق يفتح رابطه مرة وحدة من موبايله ويدوس Start.
      </p>
      {!ready && <p className="mt-3 rounded-xl bg-gold/10 px-3 py-2 text-sm text-gold">بوت التيليغرام بعده ما مربوط بالموقع.</p>}
      <ul className="mt-4 divide-y divide-line-soft">
        {barbers.map((b) => {
          const n = byId.get(b.id);
          const linked = n?.telegram_linked;
          const wa = barberWhatsapp(b.name, shopWhatsapp);
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{b.name}</p>
                <p className={`text-xs ${linked ? "text-emerald-400" : "text-faint"}`}>
                  {linked ? `مربوط ✓ ${n?.telegram_name ? `(${n.telegram_name})` : ""}` : "مو مربوط بعد"}
                  {n?.whatsapp_on ? " · واتساب مفعّل" : ""}
                </p>
              </div>
              {n?.telegram_link && (
                <div className="flex gap-2">
                  <button
                    onClick={() => navigator.clipboard?.writeText(n.telegram_link!).then(() => { setCopied(b.id); setTimeout(() => setCopied(null), 1600); })}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-xs text-mute hover:text-bone"
                  >
                    {copied === b.id ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                    {copied === b.id ? "انتسخ" : "نسخ الرابط"}
                  </button>
                  {wa && (
                    <a
                      href={whatsappLink(wa, `هلو ${b.name}، افتح هذا الرابط ودوس Start حتى توصلك حجوزاتك كصورة وصل:\n${n.telegram_link}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-gold/50 px-3 py-2 text-xs text-gold hover:bg-gold/10"
                    >
                      <Send className="size-3.5" />
                      دزه للحلاق
                    </a>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
