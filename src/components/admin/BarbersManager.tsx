"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Toggle } from "@/components/ui/Field";
import { Alert, EmptyState } from "@/components/ui/Feedback";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Monogram } from "@/components/ui/icons";
import { deleteBarber, saveBarber } from "@/app/admin/actions";
import type { Barber } from "@/lib/types";

const empty = { name: "", title: "", photo_url: "", is_active: true, sort_order: "0" };

export function BarbersManager({ barbers }: { barbers: Barber[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Barber | "new" | null>(null);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Barber | null>(null);
  const [pending, start] = useTransition();

  const openForm = (b: Barber | "new") => {
    setError(null);
    setEditing(b);
    setForm(b === "new" ? { ...empty, sort_order: String(barbers.length) } : { name: b.name, title: b.title ?? "", photo_url: b.photo_url ?? "", is_active: b.is_active, sort_order: String(b.sort_order) });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await saveBarber({ ...form, id: editing && editing !== "new" ? editing.id : undefined });
      if (!r.ok) return setError(r.error);
      setEditing(null);
      router.refresh();
    });
  };

  const remove = () =>
    start(async () => {
      if (!confirmDelete) return;
      const r = await deleteBarber(confirmDelete.id);
      if (!r.ok) setError(r.error);
      setConfirmDelete(null);
      router.refresh();
    });

  return (
    <>
      <div className="flex justify-end">
        <Button size="sm" onClick={() => openForm("new")}>
          <Plus className="size-4" /> حلاق جديد
        </Button>
      </div>
      {error && !editing && <Alert>{error}</Alert>}
      {barbers.length === 0 ? (
        <Card>
          <EmptyState icon={UserRound} title="ما اكو حلاقين" description="لازم حلاق واحد على الأقل حته تشتغل الحجوزات. إذا الصالون بيه كرسي واحد، أضف اسم صاحب الصالون." action={<Button size="sm" onClick={() => openForm("new")}><Plus className="size-4" /> أضف حلاق</Button>} />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {barbers.map((b) => (
            <Card key={b.id} className={`flex items-center gap-4 p-4 ${b.is_active ? "" : "opacity-55"}`}>
              {b.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={b.photo_url} alt={b.name} className="size-14 rounded-full object-cover" />
              ) : (
                <Monogram name={b.name} className="size-14 text-2xl" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.name}</p>
                <p className="text-xs text-mute">{b.is_active ? b.title || "حلاق" : "متوقف عن الحجز"}</p>
              </div>
              <button onClick={() => openForm(b)} className="grid size-9 place-items-center rounded-lg text-mute hover:bg-coal-3 hover:text-bone" aria-label="تعديل">
                <Pencil className="size-4" />
              </button>
              <button onClick={() => setConfirmDelete(b)} className="grid size-9 place-items-center rounded-lg text-mute hover:bg-rose-500/10 hover:text-rose-300" aria-label="حذف">
                <Trash2 className="size-4" />
              </button>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={editing !== null}
        onClose={() => { setEditing(null); setError(null); }}
        title={editing === "new" ? "حلاق جديد" : "تعديل الحلاق"}
        footer={
          <div className="flex gap-2">
            <Button form="barber-form" type="submit" className="flex-1" loading={pending}>حفظ</Button>
            <Button variant="ghost" onClick={() => { setEditing(null); setError(null); }}>إلغاء</Button>
          </div>
        }
      >
        <form id="barber-form" onSubmit={submit} className="space-y-4">
          <Input label="الاسم" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label="اللقب (اختياري)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثلاً: خبير لحية" />
          <Input label="رابط الصورة (اختياري)" dir="ltr" className="text-right" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://…" />
          <Input label="الترتيب" type="number" min={0} dir="ltr" className="text-right" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} />
          <Toggle label="يستقبل حجوزات" description="سكرها إذا الحلاق مجاز لفترة طويلة" checked={form.is_active} onChange={(v) => setForm({ ...form, is_active: v })} />
          {error && <Alert>{error}</Alert>}
        </form>
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="حذف الحلاق؟"
        footer={
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" loading={pending} onClick={remove}>حذف</Button>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>إلغاء</Button>
          </div>
        }
      >
        <p className="text-sm text-mute">إذا عنده حجوزات سابقة ما راح ينحذف حته يبقى السجل سليم. بهاي الحالة وقّف استقبال الحجوزات بدل الحذف.</p>
      </Modal>
    </>
  );
}
