import { ShieldAlert } from "lucide-react";
import { signOut } from "@/app/admin/actions";
import { Button } from "@/components/ui/Button";

export default function NoAccessPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <ShieldAlert className="size-10 text-gold" />
      <h1 className="font-display text-2xl">ما عندك صلاحية</h1>
      <p className="text-sm text-mute">
        هذا الحساب مو مضاف كمدير لهذا الصالون. صاحب الصالون يضيفه من Supabase بأمر <code className="num">setup_shop</code> (شوف README).
      </p>
      <form action={signOut}>
        <Button variant="outline">تسجيل الخروج</Button>
      </form>
    </main>
  );
}
