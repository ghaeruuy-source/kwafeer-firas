"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";
import { saveCustomer } from "@/app/admin/actions";
import type { Customer } from "@/lib/types";

export function CustomerNotesForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [name, setName] = useState(customer.name);
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveCustomer({ id: customer.id, name, notes });
          setMsg(r.ok ? { tone: "success", text: "انحفظ" } : { tone: "error", text: r.error });
          if (r.ok) router.refresh();
        });
      }}
    >
      <Input label="الاسم" value={name} onChange={(e) => setName(e.target.value)} required />
      <Textarea label="ملاحظات" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} placeholder="مثلاً: يحب الدرجة 2 بالجوانب، حساسية من بعض المنتجات…" className="min-h-32" />
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <Button type="submit" loading={pending}>
        <Save className="size-4" /> حفظ
      </Button>
    </form>
  );
}
