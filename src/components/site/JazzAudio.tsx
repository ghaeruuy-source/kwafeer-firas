"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, VolumeX } from "lucide-react";

/**
 * Beethoven's "Für Elise" (public domain) played softly on a synthesized piano,
 * plus a soft piano note on every tap, made live with Web Audio
 * (no audio files to download). Browsers only allow sound after the visitor
 * interacts, so the music starts on the first tap. A floating button mutes it,
 * and the choice is remembered.
 */

const KEY = "salon.sound";
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// Für Elise, in 16th-note steps of 6 per bar (3/8). Each step: [right hand, left hand].
type Step = [number | null, number | null];
const _ = null;
const bar = (...st: Step[]): Step[] => st;
const AM = (r1: number, r2: number, r3: number): Step[] => bar([r1, 45], [_, 52], [_, 57], [r2 === 0 ? _ : 60, _], [64, _], [69, _]);
const MOTIF = bar([76, _], [75, _], [76, _], [71, _], [74, _], [72, _]);
const A_BARS: Step[] = [
  ...MOTIF,
  ...AM(69, 1, 0),
  ...bar([71, 40], [_, 52], [_, 56], [64, _], [68, _], [71, _]),
  ...bar([72, 45], [_, 52], [_, 57], [64, _], [76, _], [75, _]),
  ...MOTIF,
  ...AM(69, 1, 0),
  ...bar([71, 40], [_, 52], [_, 56], [64, _], [72, _], [71, _]),
];
const SCORE: Step[] = [
  [76, _], [75, _],
  ...A_BARS,
  ...bar([69, 45], [_, 52], [_, 57], [_, _], [76, _], [75, _]),
  ...A_BARS,
  ...bar([69, 45], [_, 52], [_, 57], [71, _], [72, _], [74, _]),
  ...bar([76, 48], [_, 55], [_, 60], [67, _], [77, _], [76, _]),
  ...bar([74, 43], [_, 55], [_, 59], [65, _], [76, _], [74, _]),
  ...bar([72, 45], [_, 52], [_, 57], [64, _], [74, _], [72, _]),
  ...bar([71, 40], [_, 52], [_, 56], [64, _], [76, _], [75, _]),
];
const TAP_NOTES = [69, 72, 74, 76, 79, 81]; // A minor pentatonic, same key as the piece

class Jazz {
  ctx: AudioContext;
  master: GainNode;
  music: GainNode;
  fx: GainNode;
  verb: ConvolverNode;
  timer = 0;
  nextBeat = 0;
  beat = 0;
  playing = false;
  readonly spb = 0.19; // one 16th note, gentle tempo

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
    this.fx.gain.value = 0.8;
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.4);
    const wet = c.createGain();
    wet.gain.value = 0.32;
    this.verb.connect(wet).connect(this.master);
    this.music.connect(this.master);
    this.music.connect(this.verb);
    this.fx.connect(this.master);
    this.fx.connect(this.verb);
  }

  impulse(sec: number) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return b;
  }

  /** Soft piano voice: sine body + overtone + a short hammer "tine". */
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
    mg.gain.setValueAtTime(f * 0.5, t);
    mg.gain.exponentialRampToValueAtTime(1, t + 0.12);
    mod.connect(mg).connect(o1.frequency);
    for (const o of [o1, o2, mod]) {
      o.start(t);
      o.stop(t + dur + 0.05);
    }
  }

  schedule() {
    const c = this.ctx;
    while (this.nextBeat < c.currentTime + 0.3) {
      const t = this.nextBeat;
      const [rh, lh] = SCORE[this.beat % SCORE.length];
      if (rh != null) this.rhodes(rh, t, 0.16, 1.5, this.music);
      if (lh != null) this.rhodes(lh, t, 0.11, 1.4, this.music);
      // a short breath before the piece starts over
      this.nextBeat += this.beat % SCORE.length === SCORE.length - 1 ? this.spb * 4 : this.spb;
      this.beat++;
    }
  }

  start() {
    if (this.playing) return;
    this.playing = true;
    this.ctx.resume();
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.music.gain.cancelScheduledValues(this.ctx.currentTime);
    this.music.gain.setTargetAtTime(0.85, this.ctx.currentTime, 1.2); // gentle fade-in
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  /** A soft piano note for taps, with a quiet octave below. */
  tap() {
    this.ctx.resume();
    const t = this.ctx.currentTime + 0.005;
    const n = TAP_NOTES[Math.floor(Math.random() * TAP_NOTES.length)];
    this.rhodes(n, t, 0.2, 1.4, this.fx);
    this.rhodes(n - 12, t + 0.02, 0.08, 1.2, this.fx);
  }
}

export function JazzAudio() {
  const engine = useRef<Jazz | null>(null);
  const [on, setOn] = useState(true);
  const [started, setStarted] = useState(false);
  const onRef = useRef(true);

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
      if (!onRef.current) return;
      const el = (e.target as HTMLElement | null)?.closest("a, button, [role='button'], label, select, summary");
      if (!el || el.closest("[data-no-tone]")) return;
      const j = get();
      j.tap();
      if (!j.playing) {
        j.start();
        setStarted(true);
      }
    };
    document.addEventListener("pointerdown", onTap, { capture: true });
    const onHide = () => {
      if (document.hidden) engine.current?.stop();
      else if (onRef.current && engine.current) engine.current.start();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("pointerdown", onTap, { capture: true });
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
