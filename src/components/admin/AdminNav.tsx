"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Clock4, LayoutDashboard, ListChecks, LogOut, Scissors, Settings, Users, UserRound, ExternalLink, Plus, Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { signOut } from "@/app/admin/actions";

type Item = { href: string; label: string; icon: React.ComponentType<{ className?: string }>; badge?: "pending" };

// Grouped the way Fresha / Square do it: daily work first, setup after, business last.
const groups: { title: string; items: Item[] }[] = [
  {
    title: "الشغل اليومي",
    items: [
      { href: "/admin", label: "اليوم", icon: LayoutDashboard },
      { href: "/admin/calendar", label: "التقويم", icon: CalendarDays },
      { href: "/admin/bookings", label: "الحجوزات", icon: ListChecks, badge: "pending" },
      { href: "/admin/customers", label: "الزباين", icon: Users },
    ],
  },
  {
    title: "الصالون",
    items: [
      { href: "/admin/services", label: "الخدمات", icon: Scissors },
      { href: "/admin/barbers", label: "الحلاقين", icon: UserRound },
      { href: "/admin/hours", label: "الدوام والعطل", icon: Clock4 },
    ],
  },
  {
    title: "الأعمال",
    items: [
      { href: "/admin/reports", label: "التقارير", icon: BarChart3 },
      { href: "/admin/settings", label: "الإعدادات", icon: Settings },
    ],
  },
];
const allItems = groups.flatMap((g) => g.items);
const mobileMain = ["/admin", "/admin/calendar", "/admin/bookings"];

const isActive = (path: string, href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));

function Badge({ n, className }: { n: number; className?: string }) {
  if (n <= 0) return null;
  return <span className={cn("num grid min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-semibold leading-5 text-ink", className)}>{n > 99 ? "99+" : n}</span>;
}

export function AdminSidebar({ shopName, email, pending }: { shopName: string; email: string; pending: number }) {
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
      <div className="px-3 pt-4">
        <Link href="/admin?new=1" className="flex h-11 items-center justify-center gap-2 rounded-full bg-gradient-to-b from-gold-light to-gold-deep text-sm font-medium text-ink shadow-[0_8px_30px_-12px_rgba(200,155,90,0.6)] hover:brightness-105">
          <Plus className="size-4" /> حجز جديد
        </Link>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto p-3 pt-5">
        {groups.map((g) => (
          <div key={g.title}>
            <p className="px-3 pb-1.5 text-[11px] font-medium tracking-wide text-faint">{g.title}</p>
            <div className="space-y-0.5">
              {g.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(path, href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                      active ? "bg-gold/10 text-gold-light" : "text-mute hover:bg-coal-3 hover:text-bone",
                    )}
                  >
                    {active && <span className="absolute inset-y-2 right-0 w-0.5 rounded-full bg-gold" />}
                    <Icon className="size-[18px]" />
                    <span className="flex-1">{label}</span>
                    {badge === "pending" && <Badge n={pending} />}
                  </Link>
                );
              })}
            </div>
          </div>
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

export function AdminMobileNav({ pending }: { pending: number }) {
  const path = usePathname();
  const main = allItems.filter((i) => mobileMain.includes(i.href));
  const moreActive = path === "/admin/more" || allItems.filter((i) => !mobileMain.includes(i.href)).some((i) => isActive(path, i.href));
  const tab = ({ href, label, icon: Icon, badge }: Item) => (
    <Link key={href} href={href} className={cn("relative flex flex-col items-center gap-1 py-2.5 text-[11px]", isActive(path, href) ? "text-gold-light" : "text-faint")}>
      <span className="relative">
        <Icon className="size-5" />
        {badge === "pending" && <Badge n={pending} className="absolute -top-2 -left-3 min-w-4 px-1 text-[10px] leading-4" />}
      </span>
      {label}
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-coal/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden">
      <div className="grid grid-cols-5 items-end">
        {tab(main[0])}
        {tab(main[1])}
        <div className="flex justify-center">
          <Link
            href="/admin?new=1"
            aria-label="حجز جديد"
            className="-mt-5 mb-1.5 grid size-14 place-items-center rounded-full border-4 border-ink bg-gradient-to-b from-gold-light to-gold-deep text-ink shadow-[0_8px_30px_-8px_rgba(200,155,90,0.7)] active:scale-95"
          >
            <Plus className="size-6" />
          </Link>
        </div>
        {tab(main[2])}
        <Link href="/admin/more" className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", moreActive ? "text-gold-light" : "text-faint")}>
          <Menu className="size-5" />
          المزيد
        </Link>
      </div>
    </nav>
  );
}

export function MoreMenu() {
  const rest = groups.map((g) => ({ ...g, items: g.items.filter((i) => !mobileMain.includes(i.href)) })).filter((g) => g.items.length);
  return (
    <div className="space-y-6">
      {rest.map((g) => (
        <div key={g.title}>
          <p className="px-1 pb-2 text-xs text-faint">{g.title}</p>
          <div className="grid grid-cols-2 gap-2">
            {g.items.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl border border-line-soft bg-coal p-3.5 hover:border-gold/40">
                <span className="grid size-9 place-items-center rounded-xl bg-gold/10 text-gold">
                  <Icon className="size-[18px]" />
                </span>
                <span className="text-sm">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      ))}
      <div className="space-y-2">
        <Link href="/" target="_blank" className="flex items-center gap-3 rounded-2xl border border-line-soft bg-coal px-4 py-4 hover:border-gold/40">
          <ExternalLink className="size-5 text-gold" /> صفحة الزباين
        </Link>
        <form action={signOut}>
          <button className="flex w-full items-center gap-3 rounded-2xl border border-line-soft bg-coal px-4 py-4 text-rose-300">
            <LogOut className="size-5" /> تسجيل الخروج
          </button>
        </form>
      </div>
    </div>
  );
}
