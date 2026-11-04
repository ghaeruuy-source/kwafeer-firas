import { cn } from "@/lib/cn";

export function StatCard({ label, value, hint, icon: Icon, accent }: { label: string; value: React.ReactNode; hint?: string; icon: React.ComponentType<{ className?: string }>; accent?: boolean }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border p-4 sm:p-5", accent ? "border-gold/30 bg-gold/[0.06]" : "border-line-soft bg-coal/80")}>
      <div className="flex items-center justify-between">
        <p className="text-xs text-mute">{label}</p>
        <Icon className={cn("size-4", accent ? "text-gold" : "text-faint")} />
      </div>
      <p className="num mt-3 text-right font-display text-2xl text-bone sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  );
}
