import Link from "next/link";
import { CalendarSearch } from "lucide-react";
import type { Shop } from "@/lib/types";

// The shop's crest ships with the site (public/logo.png); an uploaded logo_url overrides it.
export const DEFAULT_LOGO = "/logo.png";

export function ShopMark({ shop, size = "md" }: { shop: Pick<Shop, "name" | "logo_url">; size?: "md" | "lg" | "xl" }) {
  const cls = size === "xl" ? "size-36 sm:size-44" : size === "lg" ? "size-16" : "size-11";
  const src = shop.logo_url || DEFAULT_LOGO;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={shop.name} className={`${cls} shrink-0 object-contain`} />;
}

export function SiteHeader({ shop }: { shop: Shop }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft/70 bg-ink/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <ShopMark shop={shop} />
          <span className="font-display text-lg leading-tight">{shop.name}</span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm text-mute md:flex">
          <a href="#services" className="hover:text-gold-light">الخدمات</a>
          <a href="#team" className="hover:text-gold-light">الحلاقين</a>
          <a href="#visit" className="hover:text-gold-light">الموقع</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/booking" className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-sm text-mute hover:text-bone sm:flex">
            <CalendarSearch className="size-4" />
            حجوزاتي
          </Link>
          <Link
            href="/book"
            className="rounded-full bg-gradient-to-b from-gold-light to-gold-deep px-4 py-2 text-sm font-semibold text-ink transition hover:brightness-105"
          >
            احجز الآن
          </Link>
        </div>
      </div>
    </header>
  );
}
