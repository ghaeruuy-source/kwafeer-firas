"use client";

import { useState } from "react";
import { Crown, Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { formatDateKey } from "@/lib/format";

/**
 * VIP waitlist for a fully booked day. If someone cancels or doesn't show up,
 * the salon gets the list on WhatsApp and calls the first in line.
 */
export function VipWaitlist({ date }: { date: string }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState<number | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ date, name, phone }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "صار خطأ. حاول مرة ثانية.");
      setPosition(body.position ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "صار خطأ. حاول مرة ثانية.");
    } finally {
      setBusy(false);
    }
  }

  const day = formatDateKey(date, { weekday: "long", day: "numeric", month: "long" });

  if (position != null) {
    return (
      <div className="gold-frame">
        <div className="gold-frame-inner flex flex-col items-center px-5 py-6 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-gold/15 text-gold-light">
            <Check className="size-6" />
          </span>
          <p className="mt-3 font-display text-xl text-bone">صرت بقائمة VIP ⭐</p>
          <p className="mt-1 text-sm text-mute">
            دورك رقم <span className="num font-bold text-gold-light">{position}</span> ليوم {day}. إذا انلغى أي موعد نتصل بيك أول واحد.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="gold-frame">
      <div className="gold-frame-inner space-y-3 px-5 py-6">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-full border border-gold/40 bg-gold/10 text-gold-light">
            <Crown className="size-5" />
          </span>
          <div>
            <p className="font-display text-xl text-bone">قائمة VIP</p>
            <p className="text-xs text-mute">سجّل ليوم {day}. أي زبون يلغي أو يتأخر، موعده يروحلك أول.</p>
          </div>
        </div>
        {error && <Alert>{error}</Alert>}
        <Input label="الاسم" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={60} />
        <Input label="رقم الموبايل" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoComplete="tel" dir="ltr" placeholder="07xx xxx xxxx" required />
        <Button type="submit" loading={busy} className="w-full">
          سجّلني VIP
        </Button>
      </div>
    </form>
  );
}
