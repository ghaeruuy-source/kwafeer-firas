"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Coffee, Save } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { saveWorkingHours } from "@/app/admin/actions";
import { hhmm, WEEKDAYS } from "@/lib/time";
import type { WorkingHours } from "@/lib/types";

const ORDER = [6, 0, 1, 2, 3, 4, 5];
type Day = { weekday: number; is_open: boolean; open_time: string; close_time: string; break_start: string | null; break_end: string | null };

const timeCls = "num h-10 w-full rounded-lg border border-line bg-coal-2 px-2 text-sm focus:border-gold/60 focus:outline-none disabled:opacity-40";

export function HoursEditor({ hours }: { hours: WorkingHours[] }) {
  const router = useRouter();
  const [days, setDays] = useState<Day[]>(() =>
    Array.from({ length: 7 }, (_, d) => {
      const h = hours.find((x) => x.weekday === d);
      return {
        weekday: d,
        is_open: h?.is_open ?? d !== 5,
        open_time: hhmm(h?.open_time) || "16:00",
        close_time: (hhmm(h?.close_time) || "24:00").replace(/^24:00$/, "00:00"),
        break_start: h?.break_start ? hhmm(h.break_start) : null,
        break_end: h?.break_end ? hhmm(h.break_end) : null,
      };
    }),
  );
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const update = (d: number, patch: Partial<Day>) => setDays((all) => all.map((x) => (x.weekday === d ? { ...x, ...patch } : x)));

  const copyToAll = (src: Day) => setDays((all) => all.map((x) => (x.is_open ? { ...src, weekday: x.weekday, is_open: true } : x)));

  return (
    <div className="space-y-4">
      <div className="divide-y divide-line-soft overflow-hidden rounded-2xl border border-line-soft bg-coal/70">
        {ORDER.map((d) => {
          const day = days[d];
          const hasBreak = day.break_start !== null;
          return (
            <div key={d} className="grid gap-3 px-4 py-4 sm:grid-cols-[130px_1fr] sm:items-center sm:px-5">
              <label className="flex cursor-pointer items-center gap-3">
                <input type="checkbox" checked={day.is_open} onChange={(e) => update(d, { is_open: e.target.checked })} className="size-5 accent-[var(--color-gold)]" />
                <span className={cn("font-medium", !day.is_open && "text-faint")}>{WEEKDAYS[d]}</span>
              </label>
              {day.is_open ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex flex-1 items-center gap-2">
                      <input type="time" className={timeCls} value={day.open_time} onChange={(e) => update(d, { open_time: e.target.value })} aria-label="الفتح" />
                      <span className="text-faint">←</span>
                      <input type="time" className={timeCls} value={day.close_time} onChange={(e) => update(d, { close_time: e.target.value })} aria-label="السد" />
                    </div>
                    <button
                      type="button"
                      onClick={() => update(d, hasBreak ? { break_start: null, break_end: null } : { break_start: "14:00", break_end: "15:00" })}
                      className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs", hasBreak ? "border-gold/40 text-gold-light" : "border-line text-mute hover:text-bone")}
                    >
                      <Coffee className="size-3.5" /> {hasBreak ? "شيل الاستراحة" : "استراحة"}
                    </button>
                    <button type="button" onClick={() => copyToAll(day)} className="rounded-lg px-2 py-2 text-xs text-faint hover:text-bone">
                      طبّق على كل الأيام
                    </button>
                  </div>
                  {hasBreak && (
                    <div className="flex items-center gap-2 text-xs text-mute">
                      <span className="w-16 shrink-0">الاستراحة</span>
                      <input type="time" className={timeCls} value={day.break_start ?? ""} onChange={(e) => update(d, { break_start: e.target.value })} />
                      <span className="text-faint">←</span>
                      <input type="time" className={timeCls} value={day.break_end ?? ""} onChange={(e) => update(d, { break_end: e.target.value })} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-faint">عطلة أسبوعية</p>
              )}
            </div>
          );
        })}
      </div>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button
        loading={pending}
        onClick={() => {
          setMsg(null);
          start(async () => {
            const r = await saveWorkingHours(days);
            setMsg(r.ok ? { tone: "success", text: "انحفظت أوقات الدوام" } : { tone: "error", text: r.error });
            if (r.ok) router.refresh();
          });
        }}
      >
        <Save className="size-4" /> حفظ الدوام
      </Button>
      <p className="text-xs text-faint">الحجوزات الموجودة ما تتأثر. الأوقات الجديدة تنطبق على الحجوزات الجاية.</p>
    </div>
  );
}
