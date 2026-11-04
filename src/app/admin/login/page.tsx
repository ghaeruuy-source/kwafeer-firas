import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/admin/LoginForm";

export const metadata: Metadata = { title: "دخول الإدارة", robots: { index: false } };

export default function LoginPage() {
  return (
    <main className="grain relative flex min-h-dvh items-center justify-center overflow-hidden px-5">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(200,155,90,0.14),transparent_60%)]" />
      <div className="relative w-full max-w-sm animate-rise">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="" className="mx-auto size-24 object-contain" />
          <h1 className="mt-4 font-display text-3xl">تسجيل الدخول</h1>
          <p className="mt-1 text-sm text-mute">لوحة التحكم</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
