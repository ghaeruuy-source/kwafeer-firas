"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { Alert } from "@/components/ui/Feedback";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setLoading(false);
      setError(error.message.includes("Invalid login") ? "الإيميل أو كلمة السر غلط" : "تعذر تسجيل الدخول. حاول مرة ثانية.");
      return;
    }
    const next = params.get("next");
    router.replace(next && next.startsWith("/admin") ? next : "/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-3xl border border-line-soft bg-coal/90 p-6 backdrop-blur">
      <Input label="الإيميل" type="email" dir="ltr" className="text-right" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="كلمة السر" type="password" dir="ltr" className="text-right" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      {error && <Alert>{error}</Alert>}
      <Button type="submit" size="lg" className="w-full" loading={loading}>
        <LogIn className="size-5" />
        دخول
      </Button>
    </form>
  );
}
