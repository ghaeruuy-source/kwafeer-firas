"use client";

import { useRef } from "react";

/** Hero crest: soft entrance, a gold shine that sweeps across it, and a tilt that follows touch or mouse. */
export function AnimatedCrest({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const set = (rx: number, ry: number) => {
    ref.current?.style.setProperty("--rx", `${rx}deg`);
    ref.current?.style.setProperty("--ry", `${ry}deg`);
  };
  return (
    <div
      ref={ref}
      className="crest-wrap size-36 sm:size-44"
      style={{ ["--logo" as string]: `url(${src})` }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        set(-((e.clientY - r.top) / r.height - 0.5) * 22, ((e.clientX - r.left) / r.width - 0.5) * 22);
      }}
      onPointerLeave={() => set(0, 0)}
      onPointerUp={() => set(0, 0)}
      onPointerCancel={() => set(0, 0)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className="crest-img size-full object-contain" />
      <span className="crest-shine" aria-hidden />
    </div>
  );
}
