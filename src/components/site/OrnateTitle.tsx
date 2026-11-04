/** Hero name in gold, framed by baroque scrolls that echo the crest. */
export function OrnateTitle({ text }: { text: string }) {
  return (
    <div className="ornate-title mt-4 flex w-full max-w-xl flex-col items-center" role="heading" aria-level={1}>
      <Flourish className="ornate-top h-6 w-44 sm:w-56" />
      <div className="my-1 flex w-full items-center justify-center gap-2 sm:gap-4">
        <Scroll className="h-10 w-12 shrink-0 sm:h-12 sm:w-16" />
        <span className="gold-text font-display text-[2.6rem] leading-[1.35] sm:text-6xl">{text}</span>
        <Scroll className="h-10 w-12 shrink-0 -scale-x-100 sm:h-12 sm:w-16" />
      </div>
      <Flourish className="h-6 w-44 rotate-180 sm:w-56" />
    </div>
  );
}

const GOLD = (
  <defs>
    <linearGradient id="og" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor="#f6dfa4" />
      <stop offset="0.45" stopColor="#d9b072" />
      <stop offset="1" stopColor="#9c6f2e" />
    </linearGradient>
  </defs>
);

/** Side scroll: a C-curl with a leaf, like the crest's acanthus. */
function Scroll({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 48" className={className} aria-hidden fill="none" stroke="url(#og)" strokeLinecap="round">
      {GOLD}
      <path d="M62 24 H40" strokeWidth="1.6" />
      <path d="M40 24 C30 24 26 14 18 14 C10 14 8 22 13 25 C17 27 21 23 18 20" strokeWidth="1.8" />
      <path d="M40 24 C30 24 26 34 18 34 C10 34 8 26 13 23" strokeWidth="1.8" />
      <path d="M30 18 C33 10 41 8 46 11 C40 12 35 15 33 20Z" fill="url(#og)" stroke="none" />
      <path d="M30 30 C33 38 41 40 46 37 C40 36 35 33 33 28Z" fill="url(#og)" stroke="none" />
      <circle cx="4" cy="24" r="2.4" fill="url(#og)" stroke="none" />
      <path d="M8 24 h2" strokeWidth="1.4" />
    </svg>
  );
}

/** Top / bottom flourish with a small crown-like centre. */
function Flourish({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 24" className={className} aria-hidden fill="none" stroke="url(#og)" strokeLinecap="round">
      {GOLD}
      <path d="M8 16 C40 16 60 6 92 12" strokeWidth="1.4" />
      <path d="M212 16 C180 16 160 6 128 12" strokeWidth="1.4" />
      <path d="M92 12 C98 13 100 18 96 19 C93 20 92 17 94 16" strokeWidth="1.3" />
      <path d="M128 12 C122 13 120 18 124 19 C127 20 128 17 126 16" strokeWidth="1.3" />
      <path d="M102 16 L106 8 L110 13 L114 8 L118 16 Z" fill="url(#og)" stroke="none" />
      <circle cx="110" cy="4" r="2" fill="url(#og)" stroke="none" />
      <circle cx="4" cy="16" r="1.8" fill="url(#og)" stroke="none" />
      <circle cx="216" cy="16" r="1.8" fill="url(#og)" stroke="none" />
    </svg>
  );
}
