"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Toggle } from "@/components/ui/Field";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Modal } from "@/components/ui/Modal";
import { addBlockedTime, deleteBlockedTime } from "@/app/admin/actions";
import { formatInstantDate, formatInstantTime } from "@/lib/format";
import { todayKey } from "@/lib/time";
import type { Barber, BlockedTime } from "@/lib/types";

export function BlockedTimesManager({ items, barbers, tz }: { items: BlockedTime[]; barbers: Barber[]; tz: string }) {
  const router = useRouter();
  const today = todayKey(tz);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ barber_id: "", start_date: today, end_date: today, all_day: true, start_time: "14:00", end_time: "16:00", reason: "" });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await addBlockedTime({ ...form, barber_id: form.barber_id || null });
      if (!r.ok) return setError(r.error);
      setOpen(false);
      router.refresh();
    });
  };

  const remove = (id: string) =>
    start(async () => {
      const r = await deleteBlockedTime(id);
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  const barberName = (id: string | null) => (id ? (barbers.find((b) => b.id === id)?.name ?? "حلاق") : "كل الصالون");

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => { setError(null); setOpen(true); }}>
          <Plus className="size-4" /> عطلة أو وقت مسكّر
        </Button>
      </div>
      {error && !open && <Alert>{error}</Alert>}
      <div className="overflow-hidden rounded-2xl border border-line-soft bg-coal/70">
        {items.length === 0 ? (
          <EmptyState icon={CalendarOff} title="ما اكو عطل قادمة" description="أضف عطلة رسمية، إجازة حلاق، أو ساعات مسكّرة لمناسبة." />
        ) : (
          <ul className="divide-y divide-line-soft">
            {items.map((b) => (
              <li key={b.id} className="flex items-center gap-4 px-4 py-3.5 sm:px-5">
                <CalendarOff className="size-5 shrink-0 text-gold" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{b.reason || "وقت مسكّر"} <span className="mr-1 text-xs font-normal text-mute">· {barberName(b.barber_id)}</span></p>
                  <p className="mt-0.5 text-xs text-mute">
                    من {formatInstantDate(b.starts_at, tz, { weekday: "short" })} <span className="num">{formatInstantTime(b.starts_at, tz)}</span> إلى{" "}
                    {formatInstantDate(b.ends_at, tz, { weekday: "short" })} <span className="num">{formatInstantTime(b.ends_at, tz)}</span>
                  </p>
                </div>
                <button onClick={() => remove(b.id)} disabled={pending} className="grid size-9 place-items-center rounded-lg text-mute hover:bg-rose-500/10 hover:text-rose-300" aria-label="حذف">
                  <Trash2 className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="عطلة أو وقت مسكّر"
        footer={
          <div className="flex gap-2">
            <Button form="block-form" type="submit" className="flex-1" loading={pending}>إضافة</Button>
            <Button variant="ghost" onClick={() => setOpen(false)}>إلغاء</Button>
          </div>
        }
      >
        <form id="block-form" onSubmit={submit} className="space-y-4">
          <Select label="يشمل" value={form.barber_id} onChange={(e) => setForm({ ...form, barber_id: e.target.value })}>
            <option value="">كل الصالون</option>
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>{b.name} فقط</option>
            ))}
          </Select>
          <Toggle label="يوم كامل" checked={form.all_day} onChange={(v) => setForm({ ...form, all_day: v })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="من تاريخ" type="date" required value={form.start_date} min={today} onChange={(e) => setForm({ ...form, start_date: e.target.value, end_date: form.end_date < e.target.value ? e.target.value : form.end_date })} />
            <Input label="إلى تاريخ" type="date" required value={form.end_date} min={form.start_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
          </div>
          {!form.all_day && (
            <div className="grid grid-cols-2 gap-4">
              <Input label="من الساعة" type="time" required value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              <Input label="إلى الساعة" type="time" required value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
            </div>
          )}
          <Input label="السبب (اختياري)" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} placeholder="مثلاً: عطلة العيد" maxLength={120} />
          <p className="text-xs text-faint">الحجوزات الموجودة بهذا الوقت ما تنلغي تلقائياً. راجعها من التقويم.</p>
          {error && <Alert>{error}</Alert>}
        </form>
      </Modal>
    </div>
  );
}
