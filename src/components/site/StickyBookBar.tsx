import Link from "next/link";
import { WhatsAppIcon } from "@/components/ui/icons";
import { whatsappLink } from "@/lib/format";

export function StickyBookBar({ whatsapp }: { whatsapp: string | null }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line-soft bg-[#0a221b]/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
      <div className="flex gap-2">
        <Link
          href="/book"
          className="flex h-13 flex-1 items-center justify-center rounded-full bg-gradient-to-b from-gold-light to-gold-deep py-3.5 text-base font-semibold text-ink"
        >
          احجز الآن
        </Link>
        {whatsapp && (
          <a
            href={whatsappLink(whatsapp, "مرحبا، أريد أستفسر عن موعد")}
            target="_blank"
            rel="noreferrer"
            aria-label="واتساب"
            className="grid w-14 place-items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          >
            <WhatsAppIcon className="size-6" />
          </a>
        )}
      </div>
    </div>
  );
}

export function WhatsAppFab({ whatsapp }: { whatsapp: string | null }) {
  if (!whatsapp) return null;
  return (
    <a
      href={whatsappLink(whatsapp, "مرحبا، أريد أستفسر عن موعد")}
      target="_blank"
      rel="noreferrer"
      aria-label="تواصل واتساب"
      className="fixed bottom-6 left-6 z-40 hidden size-14 place-items-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-900/40 transition hover:scale-105 md:grid"
    >
      <WhatsAppIcon className="size-7" />
    </a>
  );
}
