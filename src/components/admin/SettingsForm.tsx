"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Select, Textarea, Toggle } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { Card, CardHeader } from "@/components/ui/Card";
import { saveShopSettings } from "@/app/admin/actions";
import { formatPhonePlain } from "@/lib/format";
import type { Shop } from "@/lib/types";

export function SettingsForm({ shop }: { shop: Shop }) {
  const router = useRouter();
  const [f, setF] = useState({
    name: shop.name,
    tagline: shop.tagline ?? "",
    about: shop.about ?? "",
    logo_url: shop.logo_url ?? "",
    cover_url: shop.cover_url ?? "",
    phone: formatPhonePlain(shop.phone),
    whatsapp: formatPhonePlain(shop.whatsapp),
    instagram: shop.instagram ?? "",
    address: shop.address ?? "",
    maps_url: shop.maps_url ?? "",
    slot_interval_minutes: String(shop.slot_interval_minutes),
    booking_window_days: String(shop.booking_window_days),
    min_notice_minutes: String(shop.min_notice_minutes),
    max_active_per_customer: String(shop.max_active_per_customer),
    auto_confirm: shop.auto_confirm,
    sequential_slots: shop.sequential_slots,
  });
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const bind = (k: keyof typeof f) => ({ value: f[k] as string, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value }) });

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveShopSettings(f);
          setMsg(r.ok ? { tone: "success", text: "انحفظت الإعدادات" } : { tone: "error", text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <Card>
        <CardHeader title="معلومات الصالون" description="تظهر بصفحة الزباين" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Input label="اسم الصالون" required {...bind("name")} />
          <Input label="جملة تعريفية" {...bind("tagline")} placeholder="مثلاً: حلاقة رجالية بلمسة احترافية" />
          <Textarea label="نبذة" className="sm:col-span-2" {...bind("about")} maxLength={1000} />
          <Input label="رابط الشعار" dir="ltr" className="text-right" {...bind("logo_url")} placeholder="https://…" />
          <Input label="رابط صورة الغلاف" dir="ltr" className="text-right" {...bind("cover_url")} placeholder="https://…" />
        </div>
      </Card>

      <Card>
        <CardHeader title="التواصل والموقع" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Input label="رقم الهاتف" type="tel" dir="ltr" className="text-right" {...bind("phone")} placeholder="07XX XXX XXXX" />
          <Input label="رقم الواتساب" type="tel" dir="ltr" className="text-right" {...bind("whatsapp")} placeholder="07XX XXX XXXX" hint="زر الواتساب يظهر بكل الصفحات" />
          <Input label="انستغرام" dir="ltr" className="text-right" {...bind("instagram")} placeholder="username" />
          <Input label="العنوان" {...bind("address")} placeholder="بغداد، المنصور، شارع 14 رمضان" />
          <Input label="رابط Google Maps" dir="ltr" className="text-right sm:col-span-2" {...bind("maps_url")} placeholder="https://maps.app.goo.gl/…" />
        </div>
      </Card>

      <Card>
        <CardHeader title="قواعد الحجز" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Toggle label="مواعيد متسلسلة حسب مدة الخدمة" description="المواعيد تنطي ورا بعض بدون فراغات: إذا الخدمة نص ساعة تطلع 10:00 ثم 10:30 ثم 11:00، وبعد كل حجز يبدي الموعد اللي بعده مباشرة" checked={f.sequential_slots} onChange={(v) => setF({ ...f, sequential_slots: v })} />
          </div>
          <Select label="الفرق بين المواعيد" disabled={f.sequential_slots} hint={f.sequential_slots ? "مطفي لأن المواعيد متسلسلة" : undefined} {...bind("slot_interval_minutes")}>
            {[5, 10, 15, 20, 30, 60].map((n) => (
              <option key={n} value={n}>كل {n} دقيقة</option>
            ))}
          </Select>
          <Input label="يكدر يحجز قبل (أيام)" type="number" min={1} max={180} dir="ltr" className="text-right" {...bind("booking_window_days")} />
          <Input label="أقل مدة قبل الموعد (دقيقة)" type="number" min={0} max={1440} dir="ltr" className="text-right" {...bind("min_notice_minutes")} hint="مثلاً 30 = ما يحجز موعد بعد أقل من نص ساعة" />
          <Input label="أقصى حجوزات قادمة للزبون" type="number" min={1} max={10} dir="ltr" className="text-right" {...bind("max_active_per_customer")} />
          <div className="sm:col-span-2">
            <Toggle label="تأكيد تلقائي" description="إذا شغلته، الحجز الأونلاين يصير مؤكد مباشرة بدون مراجعة" checked={f.auto_confirm} onChange={(v) => setF({ ...f, auto_confirm: v })} />
          </div>
        </div>
      </Card>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" size="lg" loading={pending}>
        <Save className="size-5" /> حفظ الإعدادات
      </Button>
    </form>
  );
}
