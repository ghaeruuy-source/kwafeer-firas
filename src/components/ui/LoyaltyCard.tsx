import { Gift, Scissors } from "lucide-react";
import { cn } from "@/lib/cn";
import type { LoyaltyProgress } from "@/lib/loyalty";

/** Stamp card: one circle per paid visit, plus a gift circle for the reward. */
export function LoyaltyStamps({ p, className }: { p: LoyaltyProgress; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {Array.from({ length: p.every }, (_, i) => (
        <span
          key={i}
          className={cn(
            "grid size-8 place-items-center rounded-full border",
            i < p.stamps ? "border-gold bg-gold/15 text-gold" : "border-line text-faint/40",
          )}
        >
          <Scissors className="size-3.5" />
        </span>
      ))}
      <span className={cn("grid size-8 place-items-center rounded-full border-2 border-dashed", p.ready ? "animate-pulse border-gold bg-gold text-coal" : "border-gold/40 text-gold/60")}>
        <Gift className="size-4" />
      </span>
    </div>
  );
}

export function LoyaltyCard({ p, audience, className }: { p: LoyaltyProgress; audience: "customer" | "admin"; className?: string }) {
  const you = audience === "customer";
  return (
    <div className={cn("rounded-2xl border p-4", p.ready ? "border-gold/50 bg-gold/[0.08]" : "border-line-soft bg-coal/80", className)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-mute">بطاقة الولاء</p>
          <p className="mt-0.5 font-medium text-bone">{p.reward}</p>
        </div>
        <p className="num shrink-0 text-sm text-gold">
          {p.stamps}/{p.every}
        </p>
      </div>
      <LoyaltyStamps p={p} className="mt-3" />
      <p className={cn("mt-3 text-sm", p.ready ? "text-gold-light" : "text-mute")}>
        {p.ready
          ? you
            ? "مبروك! زيارتك الجاية هي المكافأة 🎁"
            : "الزيارة الجاية إله مكافأة 🎁 لا تنسى تطبقها"
          : you
            ? `باقيلك ${p.left} ${p.left === 1 ? "زيارة" : "زيارات"} وتاخذ المكافأة`
            : `باقيله ${p.left} ${p.left === 1 ? "زيارة" : "زيارات"} للمكافأة`}
      </p>
      {!you && (
        <p className="mt-1 text-xs text-faint">
          <span className="num">{p.visits}</span> زيارة مكتملة{p.redeemed > 0 && <> · أخذ المكافأة <span className="num">{p.redeemed}</span> {p.redeemed === 1 ? "مرة" : "مرات"}</>}
        </p>
      )}
    </div>
  );
}
