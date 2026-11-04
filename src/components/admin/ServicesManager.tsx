"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Pencil, Plus, Scissors, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Toggle } from "@/components/ui/Field";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { deleteService, saveService } from "@/app/admin/actions";
import { formatDuration, formatIQD } from "@/lib/format";
import type { Service } from "@/lib/types";

const empty = { name: "", description: "", price_iqd: "", duration_minutes: "30", is_active: true, sort_order: "0" };

export function ServicesManager({ services }: { services: Service[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Service | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Service | null>(null);
  const [pending, start] = useTransition();

  const openForm = (s: Service | "new") => {
    setError(null);
    setEditing(s);
    setForm(
      s === "new"
        ? { ...empty, sort_order: String(services.length) }
        : { name: s.name, description: s.description ?? "", price_iqd: String(s.price_iqd), duration_minutes: String(s.duration_minutes), is_active: s.is_active, sort_order: String(s.sort_order) },
    );
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveService({ ...form, id: editing && editing !== "new" ? editing.id : undefined });
      if (!r.ok) return setError(r.error);
      setEditing(null);
      router.refresh();
    });
  };

  const toggle = (s: Service) =>
    start(async () => {
      const r = await saveService({ ...s, description: s.description, is_active: !s.is_active });
      if (!r.ok) setError(r.error);
      router.refresh();
    });

  const remove = () =>
    start(async () => {
      if (!confirmDelete) return;
      const r = await deleteService(confirmDelete.id);
      if (!r.ok) setError(r.error);
      setConfirmDelete(null);
      router.refresh();
    });

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => openForm("new")}>
          <Plus className="size-4" /> خدمة جديدة
        </Button>
      </div>
      {error && !editing && <Alert>{error}</Alert>}
      <Card>
        {services.length === 0 ? (
          <EmptyState icon={Scissors} title="ما اكو خدمات" description="أضف أول خدمة (مثلاً حلاقة شعر) حته يكدر الزبون يحجز." action={<Button size="sm" onClick={() => openForm("new")}><Plus className="size-4" /> أضف خدمة</Button>} />
        ) : (
          <ul className="divide-y divide-line-soft">
            {services.map((s) => (
              <li key={s.id} className={`flex items-center gap-4 px-4 py-4 sm:px-5 ${s.is_active ? "" : "opacity-55"}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {s.name}
                    {!s.is_active && <span className="mr-2 rounded-full bg-coal-3 px-2 py-0.5 text-[11px] text-faint">مخفية</span>}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-mute">
                    <Clock3 className="size-3.5" /> {formatDuration(s.duration_minutes)}
                  </p>
                </div>
                <span className="num shrink-0 font-display text-gold">{formatIQD(s.price_iqd)}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => toggle(s)} disabled={pending} className="rounded-lg px-2 py-1.5 text-xs text-mute hover:bg-coal-3 hover:text-bone">
                    {s.is_active ? "إخفاء" : "إظهار"}
                  </button>
                  <button onClick={() => openForm(s)} className="grid size-9 place-items-center rounded-lg text-mute hover:bg-coal-3 hover:text-bone" aria-label="تعديل">
                    <Pencil className="size-4" />
                  </button>
                  <button onClick={() => setConfirmDelete(s)} className="grid size-9 place-items-center rounded-lg text-mute hover:bg-rose-500/10 hover:text-rose-300" aria-label="حذف">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => { setEditing(null); setError(null); }}
        title={editing === "new" ? "خدمة جديدة" : "تعديل الخدمة"}
        footer={
          <div className="flex gap-2">
            <Button form="service-form" type="submit" className="flex-1" loading={pending}>حفظ</Button>
            <Button variant="ghost" onClick={() => { setEditing(null); setError(null); }}>إلغاء</Button>
          </div>
        }
      >
        <form id="service-form" onSubmit={submit} className="space-y-4">
          <Input label="اسم الخدمة" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="مثلاً: حلاقة شعر ولحية" />
          <div className="grid grid-cols-2 gap-4">
            <Input label="السعر (دينار)" inputMode="numeric" dir="ltr" className="text-right" required value={form.price_iqd} onChange={(e) => setForm({ ...form, price_iqd: e.target.value })} placeholder="15000" />
            <Input label="المدة (دقيقة)" type="number" min={5} max={480} step={5} dir="ltr" className="text-right" required value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })} />
          </div>
          <Textarea label="وصف قصير (اختياري)" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} maxLength={300} />
          <Input label="الترتيب" type="number" min={0} dir="ltr" className="text-right" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} hint="الأصغر يطلع أول" />
          <Toggle label="متاحة للحجز" description="إذا سكرتها تختفي من صفحة الزباين" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          {error && <Alert>{error}</Alert>}
        </form>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="حذف الخدمة؟"
        footer={
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" loading={pending} onClick={remove}>حذف</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
          </div>
        }
      >
        <p className="text-sm text-mute">إذا الخدمة عليها حجوزات سابقة ما راح تنحذف حته يبقى السجل سليم. بهاي الحالة اخفيها بدل الحذف.</p>
      </Modal>
    </>
  );
}
