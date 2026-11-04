import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="num font-display text-6xl text-gold">404</p>
      <h1 className="font-display text-2xl">الصفحة مو موجودة</h1>
      <Link href="/" className="text-sm text-mute underline-offset-4 hover:text-bone hover:underline">رجوع للرئيسية</Link>
    </main>
  );
}
