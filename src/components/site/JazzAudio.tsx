"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Music2, VolumeX } from "lucide-react";

/**
 * Lounge jazz (walking bass, brushes, Rhodes) made live with Web Audio, no audio files.
 * The music answers the buttons: every tap plays a phrase that fits the chord that is
 * sounding right now, the big "book" buttons roll a full chord, hovering a button on a
 * computer plays a soft note, and the band gets a little busier for a few seconds after
 * each interaction. Browsers only allow sound after the visitor interacts, so the music
 * starts on the first tap. A floating button mutes it, and the choice is remembered.
 */

const KEY = "salon.sound";
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ii–V–I–vi in F, 2 bars each: [bass root, Rhodes voicing, melody scale]
const CHORDS: [number, number[], number[]][] = [
  [43, [58, 62, 65, 69], [67, 70, 72, 74, 77, 79, 82]], // Gm9
  [48, [58, 64, 69, 74], [67, 69, 72, 76, 79, 81, 84]], // C13
  [41, [57, 60, 64, 67], [69, 72, 74, 76, 79, 81, 84]], // Fmaj9
  [50, [53, 57, 60, 64], [69, 72, 74, 77, 79, 81, 84]], // Dm9
];

export type Gesture = "flourish" | "chord" | "note" | "hover";

class Jazz {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  fx: GainNode;
  verb: ConvolverNode;
  noise: AudioBuffer;
  timer = 0;
  nextBeat = 0;
  beat = 0;
  playing = false;
  energy = 0; // rises with each interaction, decays over a few seconds
  lastIdx = 3;
  readonly spb = 60 / 76; // tempo

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 1;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain();
    this.music.gain.value = 0;
    this.fx = c.createGain();
    this.fx.gain.value = 0.75;
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.4);
    const wet = c.createGain();
    wet.gain.value = 0.3;
    this.verb.connect(wet).connect(this.master);
    this.music.connect(this.master);
    this.music.connect(this.verb);
    this.fx.connect(this.master);
    this.fx.connect(this.verb);
    this.noise = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  impulse(sec: number) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }

  /** The chord that is sounding right now (or the first one before the band starts). */
  chord() {
    const b = this.playing ? Math.max(0, this.beat - 1) : 0;
    return CHORDS[Math.floor(Math.floor(b / 4) / 2) % CHORDS.length];
  }

  /** Electric-piano voice: sine body + soft overtone + a short bell "tine". */
  rhodes(midi: number, t: number, vel: number, dur: number, out: AudioNode) {
    const c = this.ctx, f = mtof(midi);
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.008);
    g.gain.exponentialRampToValueAtTime(vel * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 2600;
    g.connect(lp).connect(out);

    const o1 = c.createOscillator();
    o1.frequency.value = f;
    o1.connect(g);
    const o2 = c.createOscillator();
    o2.frequency.value = f * 2;
    const g2 = c.createGain();
    g2.gain.value = 0.18;
    o2.connect(g2).connect(g);
    // tine: FM bell at the attack
    const mod = c.createOscillator(), mg = c.createGain();
    mod.frequency.value = f * 7;
    mg.gain.setValueAtTime(f * 1.2, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 0.25);
    mod.connect(mg).connect(o1.frequency);
    for (const o of [o1, o2, mod]) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  bass(midi: number, t: number, vel = 0.5) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = "triangle";
    o.frequency.value = mtof(midi);
    lp.type = "lowpass";
    lp.frequency.value = 480;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t + this.spb * 0.95);
    o.connect(lp).connect(g).connect(this.music);
    o.start(t);
    o.stop(t + this.spb);
  }

  brush(t: number, vel: number, len: number) {
    const c = this.ctx, s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise;
    hp.type = "bandpass";
    hp.frequency.value = 6500;
    hp.Q.value = 0.6;
    g.gain.setValueAtTime(vel, t);
    g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    s.connect(hp).connect(g).connect(this.music);
    s.start(t, Math.random() * 0.5);
    s.stop(t + len + 0.02);
  }

  schedule() {
    const c = this.ctx;
    while (this.nextBeat < c.currentTime + 0.25) {
      const t = this.nextBeat, b = this.beat, bar = Math.floor(b / 4), inBar = b % 4;
      const [root, voicing, scale] = CHORDS[Math.floor(bar / 2) % CHORDS.length];
      const swing = this.spb * 0.66; // swung 8th
      const e = this.energy;

      // walking bass
      const walk = [root, root + 7, root + 12, root + (inBar === 3 ? 11 : 4)];
      this.bass(walk[inBar] - (walk[inBar] > 52 ? 12 : 0), t, 0.55);
      // brushes: soft swish on every beat, accent on 2 and 4; busier when the visitor is active
      this.brush(t, inBar % 2 ? 0.07 : 0.035, this.spb * 0.6);
      this.brush(t + swing, 0.025 + e * 0.03, 0.12);
      // Rhodes comping: beat 1 and the "and" of 2 (and more often when energy is up)
      if ((bar % 2 === 0 || e > 0.5) && (inBar === 0 || inBar === 1)) {
        const at = inBar === 0 ? t : t + swing;
        voicing.forEach((n, i) => this.rhodes(n, at + i * 0.012, 0.09, this.spb * 3, this.music));
      }
      // melody: sparse when idle, livelier right after button taps
      if (Math.random() < 0.35 + e * 0.45) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        this.rhodes(n, t + (Math.random() < 0.5 ? 0 : swing), 0.08, this.spb * 1.6, this.music);
        if (e > 0.4 && Math.random() < e) {
          const n2 = scale[Math.floor(Math.random() * scale.length)];
          this.rhodes(n2, t + swing, 0.06, this.spb, this.music);
        }
      }
      this.energy = Math.max(0, this.energy - 0.12);
      this.nextBeat += this.spb;
      this.beat++;
    }
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.ctx.resume();
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0.8, this.ctx.currentTime, 1.2); // gentle fade-in
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  /** Pick a note near the last one, so repeated taps sound like a little melody. */
  step(scale: number[]) {
    const move = [-2, -1, 1, 1, 2][Math.floor(Math.random() * 5)];
    this.lastIdx = Math.min(scale.length - 1, Math.max(0, this.lastIdx + move));
    return scale[this.lastIdx];
  }

  /** The band's answer to a button: always in the chord that is playing now. */
  play(g: Gesture) {
    this.ctx.resume();
    const t = this.ctx.currentTime + 0.005;
    const [, voicing, scale] = this.chord();
    if (g === "hover") {
      this.rhodes(this.step(scale), t, 0.07, 0.9, this.fx);
      return;
    }
    this.energy = Math.min(1, this.energy + (g === "flourish" ? 0.9 : 0.45));
    if (g === "flourish") {
      // big call-to-action: a rolled chord climbing into a high melody note
      const up = [...voicing, voicing[1] + 12, voicing[3] + 12];
      up.forEach((n, i) => this.rhodes(n, t + i * 0.055, 0.15 - i * 0.008, 2.2, this.fx));
      this.rhodes(scale[scale.length - 1], t + up.length * 0.055 + 0.04, 0.13, 2, this.fx);
    } else if (g === "chord") {
      // service cards, options: a soft chord stab under a melody note
      voicing.forEach((n, i) => this.rhodes(n, t + i * 0.015, 0.08, 1.4, this.fx));
      this.rhodes(this.step(scale), t + 0.03, 0.16, 1.4, this.fx);
    } else {
      // any other button or link: a note plus a sixth below, like a jazz "ding"
      const n = this.step(scale);
      this.rhodes(n, t, 0.17, 1.4, this.fx);
      this.rhodes(n - 3, t + 0.045, 0.08, 1.2, this.fx);
    }
  }
}

const CLICKABLE = "a, button, [role='button'], [role='radio'], label, select, summary";

/** Decide how the band should answer a given button. A data-tone attribute wins. */
function gestureFor(el: HTMLElement): Gesture {
  const set = el.closest<HTMLElement>("[data-tone]")?.dataset.tone;
  if (set === "flourish" || set === "chord" || set === "note") return set;
  const text = el.textContent ?? "";
  if (/احجز|أقرب موعد|اقرب موعد|تأكيد|أكّد|اكد/.test(text)) return "flourish";
  if (el.matches("[role='radio'], label") || el.closest("[role='radiogroup']") || (el.textContent?.length ?? 0) > 40) return "chord";
  return "note";
}

export function JazzAudio() {
  const engine = useRef<Jazz | null>(null);
  const [on, setOn] = useState(true);
  const [started, setStarted] = useState(false);
  const onRef = useRef(true);
  const pathname = usePathname();
  const inAdmin = pathname?.startsWith("/admin") ?? false;

  // The music is for customers only: silence it inside the salon dashboard.
  useEffect(() => {
    if (inAdmin) engine.current?.stop();
  }, [inAdmin]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "off") {
        setOn(false);
        onRef.current = false;
      }
    } catch {
      /* storage blocked */
    }

    const get = () => (engine.current ??= new Jazz());
    const onTap = (e: Event) => {
      if (!onRef.current || location.pathname.startsWith("/admin")) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(CLICKABLE);
      if (!el || el.closest("[data-no-tone]")) return;
      const j = get();
      j.play(gestureFor(el));
      if (!j.playing) {
        j.start();
        setStarted(true);
      }
    };
    document.addEventListener("pointerdown", onTap, { capture: true });

    // Hovering a button with a mouse plays a soft note, once the music is already playing.
    let lastHover: Element | null = null;
    let lastHoverAt = 0;
    const onHover = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || !onRef.current || !engine.current?.playing) return;
      const el = (e.target as HTMLElement | null)?.closest<HTMLElement>(CLICKABLE);
      if (!el || el === lastHover || el.closest("[data-no-tone]")) {
        if (!el) lastHover = null;
        return;
      }
      lastHover = el;
      const now = performance.now();
      if (now - lastHoverAt < 140) return;
      lastHoverAt = now;
      engine.current.play("hover");
    };
    document.addEventListener("pointerover", onHover, { passive: true });
    const onHide = () => {
      if (document.hidden) engine.current?.stop();
      else if (onRef.current && engine.current && !location.pathname.startsWith("/admin")) engine.current.start();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("pointerdown", onTap, { capture: true });
      document.removeEventListener("pointerover", onHover);
      document.removeEventListener("visibilitychange", onHide);
      engine.current?.stop();
    };
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    onRef.current = next;
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      /* ignore */
    }
    const j = (engine.current ??= new Jazz());
    if (next) {
      j.start();
      setStarted(true);
    } else j.stop();
  };

  if (inAdmin) return null;

  return (
    <button
      type="button"
      data-no-tone
      onClick={toggle}
      aria-label={on ? "إيقاف الموسيقى" : "تشغيل الموسيقى"}
      aria-pressed={on}
      className="fixed left-4 top-20 z-40 grid size-11 place-items-center rounded-full border border-gold/30 bg-coal/80 text-gold-light shadow-lg backdrop-blur transition hover:border-gold/60 active:scale-95"
    >
      {on ? (
        <span className="relative">
          <Music2 className="size-5" />
          {started && <span className="absolute -right-1 -top-1 size-2 animate-ping rounded-full bg-gold-light/70" />}
        </span>
      ) : (
        <VolumeX className="size-5 text-mute" />
      )}
    </button>
  );
}
