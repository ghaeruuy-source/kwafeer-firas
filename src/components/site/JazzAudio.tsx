"use client";

import { useEffect, useRef, useState } from "react";
import { Music2, VolumeX } from "lucide-react";

/**
 * Calm lounge-jazz bed + a soft jazz note on every tap, made live with Web Audio
 * (no audio files to download). Browsers only allow sound after the visitor
 * interacts, so the music starts on the first tap. A floating button mutes it,
 * and the choice is remembered.
 */

const KEY = "salon.sound";
const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// ii–V–I–vi in F, 2 bars each: [bass root, Rhodes voicing, melody scale]
const CHORDS: [number, number[], number[]][] = [
  [43, [58, 62, 65, 69], [67, 70, 72, 74, 77]], // Gm9
  [48, [58, 64, 69, 74], [67, 69, 72, 76, 79]], // C13
  [41, [57, 60, 64, 67], [69, 72, 74, 76, 79]], // Fmaj9
  [50, [53, 57, 60, 64], [69, 72, 74, 77, 79]], // Dm9
];
const TAP_NOTES = [72, 74, 76, 77, 79, 81, 84]; // F major pentatonic-ish, bright register

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
  readonly spb = 60 / 68; // tempo

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.9;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain();
    this.music.gain.value = 0;
    this.fx = c.createGain();
    this.fx.gain.value = 0.55;
    this.verb = c.createConvolver();
    this.verb.buffer = this.impulse(2.4);
    const wet = c.createGain();
    wet.gain.value = 0.28;
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
    lp.frequency.value = 420;
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

      // walking bass
      const walk = [root, root + 7, root + 12, root + (inBar === 3 ? 11 : 4)];
      this.bass(walk[inBar] - (walk[inBar] > 52 ? 12 : 0), t, 0.42);
      // brushes: soft swish on every beat, a little accent on 2 and 4
      this.brush(t, inBar % 2 ? 0.05 : 0.025, this.spb * 0.6);
      this.brush(t + swing, 0.018, 0.12);
      // Rhodes comping: beat 1 and the "and" of 2 (first bar of each chord)
      if (bar % 2 === 0 && (inBar === 0 || inBar === 1)) {
        const at = inBar === 0 ? t : t + swing;
        voicing.forEach((n, i) => this.rhodes(n, at + i * 0.012, 0.07, this.spb * 3, this.music));
      }
      // sparse melody
      if (Math.random() < 0.38) {
        const n = scale[Math.floor(Math.random() * scale.length)];
        this.rhodes(n, t + (Math.random() < 0.5 ? 0 : swing), 0.06, this.spb * 1.6, this.music);
      }
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
    this.music.gain.setTargetAtTime(0.5, this.ctx.currentTime, 1.2); // gentle fade-in
    this.timer = window.setInterval(() => this.schedule(), 80);
  }

  stop() {
    this.playing = false;
    clearInterval(this.timer);
    this.music.gain.setTargetAtTime(0, this.ctx.currentTime, 0.3);
  }

  /** A short jazz "ding" for taps: a note plus a sixth above, Rhodes voice. */
  tap() {
    this.ctx.resume();
    const t = this.ctx.currentTime + 0.005;
    const n = TAP_NOTES[Math.floor(Math.random() * TAP_NOTES.length)];
    this.rhodes(n, t, 0.16, 1.4, this.fx);
    this.rhodes(n + 9, t + 0.045, 0.09, 1.2, this.fx);
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
