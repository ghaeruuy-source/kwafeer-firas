"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Clock4, LayoutDashboard, ListChecks, LogOut, Scissors, Settings, Users, UserRound, ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut } from "@/app/admin/actions";

const items = [
  { href: "/admin", label: "الرئيسية", icon: LayoutDashboard, mobile: true },
  { href: "/admin/calendar", label: "التقويم", icon: CalendarDays, mobile: true },
  { href: "/admin/bookings", label: "الحجوزات", icon: ListChecks, mobile: true },
  { href: "/admin/customers", label: "الزباين", icon: Users, mobile: true },
  { href: "/admin/services", label: "الخدمات", icon: Scissors },
  { href: "/admin/barbers", label: "الحلاقين", icon: UserRound },
  { href: "/admin/hours", label: "الدوام والعطل", icon: Clock4 },
  { href: "/admin/reports", label: "التقارير", icon: BarChart3 },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

export function AdminSidebar({ shopName, email }: { shopName: string; email: string }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-l border-line-soft bg-coal/60 lg:flex">
      <div className="flex items-center gap-3 border-b border-line-soft px-5 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="" className="size-11 shrink-0 object-contain" />
        <div className="min-w-0">
          <p className="truncate font-display text-lg leading-tight">{shopName}</p>
          <p className="text-xs text-mute">لوحة التحكم</p>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {items.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
              isActive(path, href) ? "bg-gold/10 text-gold-light" : "text-mute hover:bg-coal-3 hover:text-bone",
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="space-y-1 border-t border-line-soft p-3">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-mute hover:bg-coal-3 hover:text-bone">
          <ExternalLink className="size-[18px]" /> صفحة الزباين
        </Link>
        <form action={signOut}>
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-mute hover:bg-coal-3 hover:text-rose-300">
            <LogOut className="size-[18px]" /> خروج
          </button>
        </form>
        <p className="truncate px-3 pt-1 text-[11px] text-faint" dir="ltr">{email}</p>
      </div>
    </aside>
  );
}

export function AdminMobileNav() {
  const path = usePathname();
  const moreActive = items.filter((i) => !i.mobile).some((i) => isActive(path, i.href));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-coal/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5">
        {items
          .filter((i) => i.mobile)
          .map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", isActive(path, href) ? "text-gold-light" : "text-faint")}>
              <Icon className="size-5" />
              {label}
            </Link>
          ))}
        <Link href="/admin/more" className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", moreActive || path === "/admin/more" ? "text-gold-light" : "text-faint")}>
          <Settings className="size-5" />
          المزيد
        </Link>
      </div>
    </nav>
  );
}

export function MoreMenu() {
  return (
    <div className="space-y-2">
      {items
        .filter((i) => !i.mobile)
        .map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border border-line-soft bg-coal px-4 py-4 hover:border-gold/40">
            <Icon className="size-5 text-gold" />
            {label}
          </Link>
        ))}
      <Link href="/" target="_blank" className="flex items-center gap-3 rounded-2xl border border-line-soft bg-coal px-4 py-4 hover:border-gold/40">
        <ExternalLink className="size-5 text-gold" /> صفحة الزباين
      </Link>
      <form action={signOut}>
        <button className="flex w-full items-center gap-3 rounded-2xl border border-line-soft bg-coal px-4 py-4 text-rose-300">
          <LogOut className="size-5" /> تسجيل الخروج
        </button>
      </form>
    </div>
  );
}
