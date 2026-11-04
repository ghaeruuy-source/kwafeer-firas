"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Ban, CheckCheck, CircleCheck, Pencil, UserX, Bell } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Feedback";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { WhatsAppIcon } from "@/components/ui/icons";
import { setBookingStatus } from "@/app/admin/actions";
import { formatDuration, formatIQD, formatInstantDate, formatInstantTime, formatPhone, whatsappLink } from "@/lib/format";
import type { BookingStatus, BookingWithRelations, Shop } from "@/lib/types";

export function BookingDetails({
  booking,
  shop,
  onClose,
  onEdit,
}: {
  booking: BookingWithRelations | null;
  shop: Pick<Shop, "name" | "timezone">;
  onClose: () => void;
  onEdit: (b: BookingWithRelations) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<BookingStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!booking) return null;
  const b = booking;
  const when = `${formatInstantDate(b.starts_at, shop.timezone)} الساعة ${formatInstantTime(b.starts_at, shop.timezone)}`;
  const phone = b.customer?.phone ?? "";
  const confirmMsg = `هلا ${b.customer?.name ?? ""} 👋\nحجزك بـ ${shop.name} مؤكد ✅\nالخدمة: ${b.service?.name}\nالموعد: ${when}\nرمز الحجز: ${b.code}`;
  const remindMsg = `هلا ${b.customer?.name ?? ""}، تذكير بموعدك اليوم بـ ${shop.name} الساعة ${formatInstantTime(b.starts_at, shop.timezone)}. ننتظرك 💈`;

  const change = (status: BookingStatus) => {
    setError(null);
    setBusy(status);
    startTransition(async () => {
      const res = await setBookingStatus(b.id, status);
      setBusy(null);
      if (!res.ok) return setError(res.error);
      onClose();
    });
  };

  const isLive = b.status === "pending" || b.status === "confirmed";

  return (
    <Modal open onClose={onClose} title={<span className="flex items-center gap-3">حجز <span className="num tracking-widest text-gold">{b.code}</span></span>}>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <StatusBadge status={b.status} />
          <span className="text-xs text-faint">{b.source === "online" ? "حجز أونلاين" : "أضيف من الإدارة"}</span>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-line-soft bg-coal-2/50 p-4 text-sm">
          <Item label="الزبون" value={b.customer ? <Link href={`/admin/customers/${b.customer.id}`} className="text-gold-light underline-offset-4 hover:underline">{b.customer.name}</Link> : "—"} />
          <Item label="الموبايل" value={<a href={`tel:+${phone}`} className="num">{formatPhone(phone)}</a>} />
          <Item label="الخدمة" value={b.service?.name ?? "—"} />
          <Item label="الحلاق" value={b.barber?.name ?? "—"} />
          <Item label="الموعد" value={when} wide />
          <Item label="المدة" value={b.service ? formatDuration(b.service.duration_minutes) : "—"} />
          <Item label="السعر" value={<span className="num">{formatIQD(b.price_iqd)}</span>} />
        </dl>

        {(b.customer_note || b.admin_note || b.customer?.notes) && (
          <div className="space-y-2 text-sm">
            {b.customer_note && <Note label="ملاحظة الزبون" text={b.customer_note} />}
            {b.admin_note && <Note label="ملاحظة داخلية" text={b.admin_note} />}
            {b.customer?.notes && <Note label="ملاحظات ملف الزبون" text={b.customer.notes} />}
          </div>
        )}

        {phone && (
          <div className="grid grid-cols-2 gap-2">
            <ButtonLink href={whatsappLink(phone, confirmMsg)} variant="outline" size="sm">
              <WhatsAppIcon className="size-4 text-emerald-400" /> رسالة تأكيد
            </ButtonLink>
            <ButtonLink href={whatsappLink(phone, remindMsg)} variant="outline" size="sm">
              <Bell className="size-4 text-gold" /> رسالة تذكير
            </ButtonLink>
          </div>
        )}

        {error && <Alert>{error}</Alert>}

        <div className="grid grid-cols-2 gap-2 border-t border-line-soft pt-5">
          {b.status === "pending" && (
            <Button onClick={() => change("confirmed")} loading={pending && busy === "confirmed"} className="col-span-2">
              <CircleCheck className="size-4" /> تأكيد الحجز
            </Button>
          )}
          {isLive && (
            <Button variant="subtle" onClick={() => change("completed")} loading={pending && busy === "completed"}>
              <CheckCheck className="size-4" /> اكتمل
            </Button>
          )}
          {isLive && (
            <Button variant="subtle" onClick={() => change("no_show")} loading={pending && busy === "no_show"}>
              <UserX className="size-4" /> ما حضر
            </Button>
          )}
          <Button variant="outline" onClick={() => onEdit(b)}>
            <Pencil className="size-4" /> تعديل
          </Button>
          {isLive ? (
            <Button variant="danger" onClick={() => change("cancelled")} loading={pending && busy === "cancelled"}>
              <Ban className="size-4" /> إلغاء
            </Button>
          ) : (
            <Button variant="subtle" onClick={() => change("confirmed")} loading={pending && busy === "confirmed"}>
              <CircleCheck className="size-4" /> رجّعه مؤكد
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Item({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-1 text-bone">{value}</dd>
    </div>
  );
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl border border-line-soft bg-coal-2/40 px-4 py-3">
      <p className="text-xs text-faint">{label}</p>
      <p className="mt-1 whitespace-pre-line text-bone/90">{text}</p>
    </div>
  );
}
