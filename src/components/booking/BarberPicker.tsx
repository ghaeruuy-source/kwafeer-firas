"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Barber } from "@/lib/types";

/**
 * Photos for the shop's barbers when the database has no photo_url yet.
 * Drop the image in public/barbers/ and it shows up without touching the database.
 */
const LOCAL_PHOTOS: { match: RegExp; src: string }[] = [
  { match: /فراس/, src: "/barbers/firas.webp" },
  { match: /زيد/, src: "/barbers/zaid.webp" },
];

/** Each barber's own WhatsApp (international format). Anyone not listed uses the shop's number. */
const LOCAL_WHATSAPP: { match: RegExp; phone: string }[] = [{ match: /زيد/, phone: "9647825538530" }];

export function barberWhatsapp(name: string | null | undefined, shopWhatsapp: string | null): string | null {
  return (name && LOCAL_WHATSAPP.find((p) => p.match.test(name))?.phone) || shopWhatsapp || null;
}

export function barberPhoto(b: Pick<Barber, "name" | "photo_url">): string | null {
  return b.photo_url || LOCAL_PHOTOS.find((p) => p.match.test(b.name))?.src || null;
}

export function BarberPicker({ barbers, selectedId, onPick }: { barbers: Barber[]; selectedId: string | null; onPick: (id: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-5">
      {barbers.map((b, i) => (
        <BarberCard key={b.id} barber={b} index={i} selected={b.id === selectedId} onClick={() => onPick(b.id)} />
      ))}
    </div>
  );
}

function BarberCard({ barber, index, selected, onClick }: { barber: Barber; index: number; selected: boolean; onClick: () => void }) {
  const photo = barberPhoto(barber);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ animationDelay: `${index * 90}ms` }}
      className={cn(
        "group relative flex animate-rise flex-col overflow-hidden rounded-[18px] p-[1.5px] text-center transition active:scale-[0.98]",
        "bg-[linear-gradient(150deg,#f3d79a,#b5853f_35%,#6e4f22_55%,#d9b072_80%,#f3d79a)]",
        selected ? "shadow-[0_0_0_2px_var(--color-gold),0_18px_40px_-12px_rgba(200,155,90,0.55)]" : "shadow-[0_14px_34px_-16px_rgba(0,0,0,0.8)] hover:shadow-[0_18px_40px_-14px_rgba(200,155,90,0.4)]",
      )}
    >
      <span className="relative flex flex-1 flex-col rounded-[16.5px] bg-[radial-gradient(120%_80%_at_50%_0%,#1b4639,#0d2a22_70%)]">
        {/* portrait in an arched gold frame */}
        <span className="relative mx-3 mt-3 block aspect-[3/4] overflow-hidden rounded-t-[999px] rounded-b-xl border border-gold/60 bg-black/30 sm:mx-4 sm:mt-4">
          {photo ? (
            <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_40%,#22564a,#0d2a22_75%)]">
              <span className="relative w-[84%] rounded-full bg-[linear-gradient(150deg,#f3d79a,#b5853f_40%,#6e4f22_60%,#d9b072)] p-[3px] shadow-[0_10px_30px_-8px_rgba(0,0,0,0.7)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt={barber.name} className="aspect-square w-full rounded-full object-cover transition duration-700 group-hover:scale-[1.03]" />
              </span>
            </span>
          ) : (
            <Monogram name={barber.name} />
          )}
          <span className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(243,215,154,0.25),inset_0_-40px_50px_-20px_rgba(0,0,0,0.65)]" />
        </span>

        <Flourish />

        <span className="px-2 pb-4">
          <span className="block font-display text-lg leading-tight text-gold-light sm:text-2xl">{barber.name}</span>
          {barber.title && <span className="mt-1 block text-[11px] text-mute sm:text-xs">{barber.title}</span>}
          <span
            className={cn(
              "mx-auto mt-3 inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1 text-xs transition",
              selected ? "border-gold bg-gold text-ink" : "border-gold/50 text-gold-light group-hover:bg-gold/10",
            )}
          >
            {selected && <Check className="size-3.5" />}
            احجز وياه
          </span>
        </span>
      </span>
    </button>
  );
}

/** Placeholder until the real photo arrives: the first letter in gold on a baroque medallion. */
function Monogram({ name }: { name: string }) {
  const letter = name.trim().charAt(0);
  return (
    <span className="grid size-full place-items-center bg-[radial-gradient(circle_at_50%_40%,#22564a,#0d2a22_75%)]">
      <svg viewBox="0 0 120 120" className="w-3/4" aria-hidden>
        <defs>
          <linearGradient id="mg" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f3d79a" />
            <stop offset=".5" stopColor="#c89b5a" />
            <stop offset="1" stopColor="#8a6328" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="52" fill="none" stroke="url(#mg)" strokeWidth="1.5" />
        <circle cx="60" cy="60" r="46" fill="none" stroke="url(#mg)" strokeWidth=".6" strokeDasharray="2 3" />
        {[0, 90, 180, 270].map((a) => (
          <path key={a} transform={`rotate(${a} 60 60)`} d="M60 4 c-4 4-4 8 0 10 c4-2 4-6 0-10z" fill="url(#mg)" />
        ))}
        <text x="60" y="76" textAnchor="middle" fontSize="48" fill="url(#mg)" style={{ fontFamily: "var(--font-display)" }}>
          {letter}
        </text>
      </svg>
    </span>
  );
}

function Flourish() {
  return (
    <svg viewBox="0 0 160 16" className="mx-auto my-2 h-3.5 w-28 text-gold" aria-hidden>
      <path d="M2 8h56M102 8h56" stroke="currentColor" strokeWidth=".8" opacity=".7" />
      <path d="M80 2l6 6-6 6-6-6z" fill="currentColor" />
      <path d="M58 8c6-6 10-6 14 0c-4 6-8 6-14 0zM102 8c-6-6-10-6-14 0c4 6 8 6 14 0z" fill="none" stroke="currentColor" strokeWidth=".9" />
    </svg>
  );
}
