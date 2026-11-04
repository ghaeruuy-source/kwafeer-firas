"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { saveBooking } from "@/app/admin/actions";
import { formatDuration, formatIQD, formatPhonePlain } from "@/lib/format";
import { STATUS_LABEL, ALL_STATUSES } from "@/lib/status";
import { todayKey, toDateKey, toTimeKey } from "@/lib/time";
import type { Barber, BookingStatus, BookingWithRelations, Service } from "@/lib/types";

export function BookingForm({
  open,
  onClose,
  booking,
  services,
  barbers,
  tz,
  defaultDate,
}: {
  open: boolean;
  onClose: () => void;
  booking?: BookingWithRelations | null;
  services: Service[];
  barbers: Barber[];
  tz: string;
  defaultDate?: string;
}) {
  const router = useRouter();
  const editing = Boolean(booking);
  const activeBarbers = barbers.filter((b) => b.is_active || b.id === booking?.barber_id);
  const activeServices = services.filter((s) => s.is_active || s.id === booking?.service_id);

  const [form, setForm] = useState(() => ({
    service_id: booking?.service_id ?? activeServices[0]?.id ?? "",
    barber_id: booking?.barber_id ?? activeBarbers[0]?.id ?? "",
    date: booking ? toDateKey(new Date(booking.starts_at), tz) : (defaultDate ?? todayKey(tz)),
    time: booking ? toTimeKey(new Date(booking.starts_at), tz) : "",
    status: (booking?.status ?? "confirmed") as BookingStatus,
    name: booking?.customer?.name ?? "",
    phone: booking?.customer?.phone ? formatPhonePlain(booking.customer.phone) : "",
    admin_note: booking?.admin_note ?? "",
  }));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const service = services.find((s) => s.id === form.service_id);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveBooking({ ...form, id: booking?.id });
      if (!res.ok) return setError(res.error);
      onClose();
      router.refresh();
    });
  }

  const noCatalog = activeServices.length === 0 || activeBarbers.length === 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `تعديل الحجز ${booking!.code}` : "حجز جديد"}
      footer={
        <div className="flex gap-2">
          <Button form="booking-form" type="submit" className="flex-1" loading={pending} disabled={noCatalog}>
            <Save className="size-4" />
            {editing ? "حفظ التعديلات" : "إضافة الحجز"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
        </div>
      }
    >
      {noCatalog ? (
        <Alert tone="info">أضف خدمة وحلاق واحد على الأقل قبل إضافة الحجوزات.</Alert>
      ) : (
        <form id="booking-form" onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="اسم الزبون" required value={form.name} onChange={(e) => set("name", e.target.value)} />
            <Input
              label="رقم الموبايل"
              type="tel"
              dir="ltr"
              className="text-right"
              required
              disabled={editing}
              hint={editing ? "الرقم مرتبط بملف الزبون" : undefined}
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="07XX XXX XXXX"
            />
          </div>
          <Select label="الخدمة" value={form.service_id} onChange={(e) => set("service_id", e.target.value)}>
            {activeServices.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} · {formatDuration(s.duration_minutes)} · {formatIQD(s.price_iqd)}
              </option>
            ))}
          </Select>
          <Select label="الحلاق" value={form.barber_id} onChange={(e) => set("barber_id", e.target.value)}>
            {activeBarbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-2 gap-4">
            <Input label="التاريخ" type="date" required value={form.date} onChange={(e) => set("date", e.target.value)} />
            <Input label="الوقت" type="time" required step={300} value={form.time} onChange={(e) => set("time", e.target.value)} />
          </div>
          {service && <p className="text-xs text-faint">المدة {formatDuration(service.duration_minutes)}. النظام يتأكد من الدوام والاستراحة وعدم التداخل.</p>}
          <Select label="الحالة" value={form.status} onChange={(e) => set("status", e.target.value as BookingStatus)}>
            {(editing ? ALL_STATUSES : (["confirmed", "pending"] as BookingStatus[])).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
          <Textarea label="ملاحظة داخلية" value={form.admin_note} onChange={(e) => set("admin_note", e.target.value)} maxLength={500} hint="ما تظهر للزبون" />
          {error && <Alert>{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
