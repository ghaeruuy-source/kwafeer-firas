"use client";

import { useEffect, useRef, useState } from "react";

type P = { tx: number; ty: number; z: number; x: number; y: number; vx: number; vy: number; r: number; g: number; b: number; s: number; tw: number };

/**
 * Hero crest made of gold particles.
 * - Assembles on load, then the crisp logo fades in over it.
 * - Drag a finger / mouse over it: particles part around the pointer and swirl.
 * - Tap: the crest bursts outward with a ring and gathers back.
 * - Tilt the phone (or move the mouse): layers shift in depth.
 * Falls back to the plain logo when the user prefers reduced motion.
 */
export function ParticleCrest({ src, alt }: { src: string; alt: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const crisp = useRef<HTMLImageElement>(null);
  const [hint, setHint] = useState(false);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStill(true);
      return;
    }
    const cv = canvas.current!, box = wrap.current!, img = crisp.current!;
    const ctx = cv.getContext("2d")!;
    let W = 0, dpr = 1, parts: P[] = [], raf = 0, visible = true, t = 0;
    let calm = 0; // frames the crest has been at rest
    let shown = false;
    const ptr = { x: -1e4, y: -1e4, down: false, active: false };
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    const rings: { x: number; y: number; r: number; a: number }[] = [];
    let touched = false;
    const hintTimer = window.setTimeout(() => !touched && setHint(true), 2600);

    const source = new Image();
    source.src = src;

    function build() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = box.clientWidth;
      cv.width = cv.height = Math.round(W * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const off = document.createElement("canvas");
      off.width = off.height = Math.round(W);
      const oc = off.getContext("2d", { willReadFrequently: true })!;
      oc.drawImage(source, 0, 0, W, W);
      const d = oc.getImageData(0, 0, off.width, off.height).data;
      const step = W < 240 ? 3 : 4;
      const old = parts;
      parts = [];
      for (let y = 0; y < off.height; y += step)
        for (let x = 0; x < off.width; x += step) {
          const i = (y * off.width + x) * 4;
          if (d[i + 3] < 150) continue;
          const prev = old[parts.length];
          const a = Math.random() * Math.PI * 2, rad = W * (0.6 + Math.random() * 0.5);
          parts.push({
            tx: x, ty: y, z: Math.random(),
            x: prev ? prev.x : W / 2 + Math.cos(a) * rad,
            y: prev ? prev.y : W / 2 + Math.sin(a) * rad,
            vx: 0, vy: 0, r: d[i], g: d[i + 1], b: d[i + 2],
            s: step * (0.55 + Math.random() * 0.35), tw: Math.random() * Math.PI * 2,
          });
        }
    }

    function burst(cx: number, cy: number, power: number) {
      for (const p of parts) {
        const dx = p.x - cx, dy = p.y - cy, dist = Math.hypot(dx, dy) || 1;
        const f = power * (0.6 + p.z) * Math.max(0.25, 1 - dist / (W * 0.9));
        p.vx += (dx / dist) * f + (Math.random() - 0.5) * 3;
        p.vy += (dy / dist) * f + (Math.random() - 0.5) * 3;
      }
      rings.push({ x: cx, y: cy, r: 4, a: 0.9 });
      calm = 0;
    }

    function frame() {
      t += 1;
      tilt.x += (tilt.tx - tilt.x) * 0.08;
      tilt.y += (tilt.ty - tilt.y) * 0.08;
      ctx.clearRect(0, 0, W, W);

      // idle shimmer: a bright band that sweeps across every ~5s
      const sweep = ((t % 300) / 300) * (W * 2.4) - W * 0.7;
      let motion = 0;
      const R = W * 0.2, R2 = R * R;
      for (const p of parts) {
        if (ptr.active) {
          const dx = p.x - ptr.x, dy = p.y - ptr.y, dd = dx * dx + dy * dy;
          if (dd < R2) {
            const f = (1 - dd / R2) * (ptr.down ? 2.6 : 1.6);
            const inv = 1 / (Math.sqrt(dd) || 1);
            // push away + a little swirl around the finger
            p.vx += (dx * inv + -dy * inv * 0.55) * f;
            p.vy += (dy * inv + dx * inv * 0.55) * f;
          }
        }
        const ox = tilt.x * (p.z - 0.5) * 18, oy = tilt.y * (p.z - 0.5) * 18;
        p.vx += (p.tx + ox - p.x) * 0.05;
        p.vy += (p.ty + oy - p.y) * 0.05;
        p.vx *= 0.86;
        p.vy *= 0.86;
        p.x += p.vx;
        p.y += p.vy;
        motion += Math.abs(p.vx) + Math.abs(p.vy);

        const band = Math.max(0, 1 - Math.abs(p.tx + p.ty * 0.6 - sweep) / 26);
        const glow = 0.78 + Math.sin(t * 0.05 + p.tw) * 0.18 + band * 0.6;
        const k = Math.min(1.6, glow);
        ctx.fillStyle = `rgb(${Math.min(255, p.r * k)},${Math.min(255, p.g * k)},${Math.min(255, p.b * k + band * 40)})`;
        ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      for (let i = rings.length - 1; i >= 0; i--) {
        const g = rings[i];
        g.r += 5.5;
        g.a *= 0.94;
        ctx.strokeStyle = `rgba(217,176,114,${g.a})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(g.x, g.y, g.r, 0, Math.PI * 2);
        ctx.stroke();
        if (g.a < 0.03) rings.splice(i, 1);
      }

      // crisp logo shows when the particles are at rest, hides when disturbed
      const avg = motion / Math.max(1, parts.length);
      calm = avg < 0.12 && !ptr.active ? calm + 1 : 0;
      const wantShown = calm > 24;
      if (wantShown !== shown) {
        shown = wantShown;
        img.style.opacity = shown ? "1" : "0";
        cv.style.opacity = shown ? "0.0" : "1";
      }
      img.style.transform = `rotateX(${-tilt.y * 10}deg) rotateY(${tilt.x * 10}deg)`;

      raf = visible ? requestAnimationFrame(frame) : 0;
    }

    const local = (e: PointerEvent) => {
      const r = cv.getBoundingClientRect();
      ptr.x = ((e.clientX - r.left) / r.width) * W;
      ptr.y = ((e.clientY - r.top) / r.height) * W;
    };
    const firstTouch = () => {
      if (touched) return;
      touched = true;
      setHint(false);
      // iPhone needs permission for tilt; asked on the first tap
      const DOE = window.DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
      DOE?.requestPermission?.().catch(() => {});
    };
    let downAt = 0, downX = 0, downY = 0;
    const onMove = (e: PointerEvent) => {
      local(e);
      ptr.active = true;
      if (e.pointerType === "mouse") {
        const r = box.getBoundingClientRect();
        tilt.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        tilt.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      }
    };
    const onDown = (e: PointerEvent) => {
      firstTouch();
      local(e);
      ptr.down = ptr.active = true;
      downAt = performance.now();
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      const quick = performance.now() - downAt < 260 && Math.hypot(e.clientX - downX, e.clientY - downY) < 12;
      if (quick) burst(ptr.x, ptr.y, 11);
      ptr.down = false;
      if (e.pointerType !== "mouse") ptr.active = false;
    };
    const onLeave = () => {
      ptr.active = ptr.down = false;
      tilt.tx = tilt.ty = 0;
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      tilt.tx = Math.max(-1, Math.min(1, e.gamma / 25));
      tilt.ty = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
    };

    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointerleave", onLeave);
    cv.addEventListener("pointercancel", onLeave);
    window.addEventListener("deviceorientation", onOrient);

    const io = new IntersectionObserver(([en]) => {
      visible = en.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    const onResize = () => source.complete && build();
    source.onload = () => {
      build();
      io.observe(box);
      raf = requestAnimationFrame(frame);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      clearTimeout(hintTimer);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("deviceorientation", onOrient);
      cv.removeEventListener("pointermove", onMove);
      cv.removeEventListener("pointerdown", onDown);
      cv.removeEventListener("pointerup", onUp);
      cv.removeEventListener("pointerleave", onLeave);
      cv.removeEventListener("pointercancel", onLeave);
    };
  }, [src]);

  return (
    <div className="relative flex flex-col items-center">
      <div ref={wrap} className="particle-crest relative size-60 sm:size-72" style={{ ["--logo" as string]: `url(${src})` }}>
        <span className="absolute inset-[-18%] rounded-full bg-[radial-gradient(circle,rgba(200,155,90,0.22),transparent_62%)]" aria-hidden />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={crisp}
          src={src}
          alt={alt}
          className="pointer-events-none absolute inset-0 size-full object-contain transition-opacity duration-500 [transform-style:preserve-3d]"
          style={{ opacity: still ? 1 : 0, filter: "drop-shadow(0 14px 32px rgb(0 0 0 / 0.4))" }}
        />
        {!still && <span className="crest-shine" aria-hidden />}
        {!still && (
          <canvas ref={canvas} className="absolute inset-0 size-full touch-none transition-opacity duration-500" aria-hidden />
        )}
      </div>
      <span
        className={`pointer-events-none mt-1 text-xs text-faint transition-opacity duration-700 ${hint ? "opacity-100" : "opacity-0"}`}
        aria-hidden
      >
        المس اللوكو ✦
      </span>
    </div>
  );
}
