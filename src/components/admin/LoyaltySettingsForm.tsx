"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gift, Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardHeader } from "@/components/ui/Card";
import { LoyaltyStamps } from "@/components/ui/LoyaltyCard";
import { saveLoyaltySettings } from "@/app/admin/actions";
import { DEFAULT_LOYALTY, loyaltyProgress } from "@/lib/loyalty";
import type { Shop } from "@/lib/types";

const PRESETS = [
  { every: 5, reward: "الحلاقة السادسة مجاناً" },
  { every: 4, reward: "خصم 50% على الزيارة الخامسة" },
  { every: 9, reward: "الحلاقة العاشرة مجاناً" },
];

export function LoyaltySettingsForm({ shop }: { shop: Shop }) {
  const router = useRouter();
  const [every, setEvery] = useState(String(shop.loyalty_every ?? DEFAULT_LOYALTY.every));
  const [reward, setReward] = useState(shop.loyalty_reward ?? DEFAULT_LOYALTY.reward);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const n = Number(every) || 0;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveLoyaltySettings({ loyalty_every: every, loyalty_reward: reward });
          setMsg(r.ok ? { tone: "success", text: "انحفظت بطاقة الولاء" } : { tone: "error", text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <Card>
        <CardHeader title="بطاقة الولاء" description="الموقع يحسب زيارات كل زبون من رقم موبايله (الحجوزات المكتملة بس). بعد كم زيارة ياخذ مكافأة؟" />
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.reward}
                type="button"
                onClick={() => {
                  setEvery(String(p.every));
                  setReward(p.reward);
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm text-mute hover:border-gold/50 hover:text-gold-light"
              >
                <Gift className="size-3.5" /> {p.reward}
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="عدد الزيارات قبل المكافأة" type="number" min={0} max={50} dir="ltr" className="text-right" value={every} onChange={(e) => setEvery(e.target.value)} hint="0 = البطاقة مطفية" />
            <Input label="المكافأة" value={reward} onChange={(e) => setReward(e.target.value)} maxLength={80} placeholder="مثلاً: الحلاقة السادسة مجاناً" />
          </div>
          {n > 0 && n <= 50 && (
            <div className="rounded-xl bg-coal-2/60 p-3">
              <p className="mb-2 text-xs text-faint">هيج تطلع للزبون:</p>
              <LoyaltyStamps p={loyaltyProgress(Math.min(2, n), { every: n, reward })} />
              <p className="mt-2 text-xs text-faint">بعد <span className="num">{n}</span> زيارات مكتملة، الزيارة اللي بعدها هي المكافأة وبعدها البطاقة تبدي من جديد.</p>
            </div>
          )}
          {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
          <Button type="submit" loading={pending}>
            <Save className="size-4" /> حفظ بطاقة الولاء
          </Button>
        </div>
      </Card>
    </form>
  );
}
