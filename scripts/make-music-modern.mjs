// Generates Typo Tyrant's original *modern* soundtrack (for the default Modern look) as WAV files
// in assets/music. Same idea as make-music.mjs (all synthesized here, no samples, no borrowed
// melodies), but with a cinematic synth sound instead of chiptune:
//   music-main-modern.wav  – warm, driving loop (A minor, 112 BPM, 8 bars): pads, plucks, sub bass
//   music-boss-modern.wav  – darker, faster loop (D minor, 140 BPM, 8 bars): pulsing bass, stabs, toms
//   victory-modern.wav     – short triumphant swell when a boss is defeated
// Run with: node scripts/make-music-modern.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 22050;
const outDir = new URL("../assets/music/", import.meta.url);
mkdirSync(outDir, { recursive: true });

/* ---------- notes ---------- */
const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
function freq(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 440 * Math.pow(2, ((Number(m[2]) + 1) * 12 + NOTE[m[1]] - 69) / 12);
}

/* ---------- synthesis ---------- */
const TAU = 2 * Math.PI;

class Mix {
  constructor(seconds, loop) {
    this.n = Math.round(seconds * RATE);
    this.buf = new Float32Array(this.n);
    this.loop = loop;
  }
  add(i, v) {
    if (i >= this.n) {
      if (!this.loop) return;
      i %= this.n;
    }
    this.buf[i] += v;
  }
  /**
   * A synth voice: detuned saws or sines, an envelope, and a gentle low-pass filter that can
   * open over time ("cutoff" 0..1). Covers pads, plucks, leads and bass.
   */
  voice(at, dur, f, o = {}) {
    const {
      type = "saw", // "saw" (detuned supersaw), "sine", "tri"
      detune = 0.012, // saw spread
      voices = 3,
      vol = 0.12,
      attack = 0.01,
      decay = 0.2,
      sustain = 0.7,
      release = 0.15,
      cutoff = 0.35, // 0 dark .. 1 bright
      cutoffEnd, // filter sweep target
      vibrato = 0,
    } = o;
    const start = Math.round(at * RATE);
    const len = Math.round(dur * RATE);
    const rel = Math.round(release * RATE);
    const phases = Array.from({ length: voices }, (_, k) => k / voices);
    let y = 0; // filter state
    for (let i = 0; i < len + rel; i++) {
      const t = i / RATE;
      const env =
        (t < attack ? t / attack : sustain + (1 - sustain) * Math.exp(-(t - attack) / Math.max(0.001, decay))) *
        (i < len ? 1 : 1 - (i - len) / rel);
      const vib = vibrato ? 1 + vibrato * Math.sin(TAU * 5.5 * t) * Math.min(1, t * 2) : 1;
      let s = 0;
      for (let k = 0; k < voices; k++) {
        const spread = voices === 1 ? 0 : (k / (voices - 1) - 0.5) * 2 * detune;
        phases[k] += (f * vib * (1 + spread)) / RATE;
        const p = phases[k] % 1;
        s += type === "saw" ? 2 * p - 1 : type === "tri" ? 1 - 4 * Math.abs(p - 0.5) : Math.sin(TAU * p);
      }
      s /= voices;
      const c = cutoffEnd === undefined ? cutoff : cutoff + (cutoffEnd - cutoff) * Math.min(1, i / (len || 1));
      y += (0.02 + 0.6 * c * c) * (s - y); // one-pole low-pass
      this.add(start + i, y * vol * env);
    }
  }
  kick(at, vol = 0.7) {
    const start = Math.round(at * RATE);
    const len = Math.round(0.3 * RATE);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      phase += (110 * Math.pow(40 / 110, Math.min(1, t * 3))) / RATE;
      this.add(start + i, Math.sin(TAU * phase) * vol * Math.pow(1 - t, 2.2));
    }
  }
  noise(at, dur, vol, bright = 0.5) {
    const start = Math.round(at * RATE);
    const len = Math.round(dur * RATE);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      lp += 0.3 * (w - lp);
      const s = bright * (w - lp) + (1 - bright) * lp; // blend of high and low noise
      this.add(start + i, s * vol * Math.pow(1 - i / len, 3));
    }
  }
  clap(at, vol = 0.3) {
    for (const d of [0, 0.012, 0.024]) this.noise(at + d, 0.16, vol * (d ? 0.6 : 1), 0.7);
  }
  hat(at, vol = 0.05) {
    this.noise(at, 0.035, vol, 1);
  }
  tom(at, f, vol = 0.4) {
    const start = Math.round(at * RATE);
    const len = Math.round(0.28 * RATE);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      phase += (f * (1 - 0.35 * t)) / RATE;
      this.add(start + i, Math.sin(TAU * phase) * vol * Math.pow(1 - t, 2));
    }
  }
  /** A feedback echo for space (wraps around in loops so the seam stays clean). */
  echo(delaySec, feedback = 0.3, mix = 0.35) {
    const d = Math.round(delaySec * RATE);
    const wet = new Float32Array(this.n);
    for (let pass = 0; pass < (this.loop ? 2 : 1); pass++) {
      for (let i = 0; i < this.n; i++) {
        const j = i - d;
        const src = j >= 0 ? this.buf[j] + wet[j] * feedback : this.loop ? this.buf[j + this.n] + wet[j + this.n] * feedback : 0;
        wet[i] = src;
      }
    }
    for (let i = 0; i < this.n; i++) this.buf[i] += wet[i] * mix;
  }
  wav() {
    let peak = 0;
    for (const v of this.buf) peak = Math.max(peak, Math.abs(v));
    const gain = peak > 0 ? 0.88 / peak : 1;
    const data = Buffer.alloc(this.n * 2);
    // Soft clip for a warmer, louder master.
    this.buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.tanh(v * gain * 1.2) * 0.95 * 32767), i * 2));
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
    h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
  }
}

/** Steps: a note ("E5"), "-" to hold the previous note, "." for a rest. */
function line(mix, steps, stepDur, startAt, opts) {
  const tokens = steps.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "-" || tok === ".") continue;
    let len = 1;
    while (tokens[i + len] === "-") len++;
    mix.voice(startAt + i * stepDur, len * stepDur * 0.95, freq(tok), opts);
  }
}

/* ---------- main theme: A minor, 112 BPM, sixteenth grid, Am F C G | Am F G E ---------- */
{
  const bpm = 112;
  const beat = 60 / bpm;
  const six = beat / 4;
  const bars = 8;
  const mix = new Mix(bars * 4 * beat, true);
  const chords = [
    ["A2", ["A3", "C4", "E4"]],
    ["F2", ["F3", "A3", "C4"]],
    ["C2", ["G3", "C4", "E4"]],
    ["G2", ["G3", "B3", "D4"]],
    ["A2", ["A3", "C4", "E4"]],
    ["F2", ["F3", "A3", "C4"]],
    ["G2", ["G3", "B3", "D4"]],
    ["E2", ["G#3", "B3", "E4"]],
  ];
  for (let b = 0; b < bars; b++) {
    const t0 = b * 4 * beat;
    const [root, tones] = chords[b];
    // Lush pad: each chord tone as a slow, wide supersaw.
    for (const n of tones) mix.voice(t0, 4 * beat, freq(n), { type: "saw", voices: 5, detune: 0.014, vol: 0.05, attack: 0.35, decay: 1, sustain: 0.85, release: 0.4, cutoff: 0.25, cutoffEnd: 0.45 });
    // Sub bass on the beat, with a pumping off-beat.
    for (let q = 0; q < 4; q++) {
      mix.voice(t0 + q * beat, beat * 0.45, freq(root), { type: "sine", voices: 1, vol: 0.34, attack: 0.005, decay: 0.2, sustain: 0.6, release: 0.05 });
      mix.voice(t0 + q * beat + beat / 2, beat * 0.4, freq(root) * 2, { type: "saw", voices: 2, vol: 0.06, attack: 0.005, decay: 0.12, sustain: 0.3, cutoff: 0.3 });
    }
    // Plucky arpeggio (sixteenths): bright, short, with echo added later.
    const arp = [0, 1, 2, 1, 2, 0, 1, 2, 0, 1, 2, 1, 2, 0, 1, 2];
    for (let s = 0; s < 16; s++) {
      const n = tones[arp[s]].replace(/(\d)$/, d => String(Number(d) + 1));
      mix.voice(t0 + s * six, six * 0.9, freq(n), { type: "saw", voices: 2, detune: 0.006, vol: 0.05, attack: 0.002, decay: 0.08, sustain: 0.05, release: 0.05, cutoff: 0.55 });
    }
    // Drums: four-on-the-floor kick, clap on 2 and 4, soft sixteenth hats.
    for (let q = 0; q < 4; q++) {
      mix.kick(t0 + q * beat, 0.6);
      if (q % 2 === 1) mix.clap(t0 + q * beat, 0.22);
    }
    for (let s = 0; s < 16; s++) if (s % 2 === 1 || s % 4 === 2) mix.hat(t0 + s * six, s % 4 === 2 ? 0.05 : 0.03);
  }
  // Lead melody in the second half: a soft, singing synth with vibrato.
  const lead = [
    "E5 - - - . . C5 D5 E5 - G5 - E5 - D5 C5", // Am
    "F5 - - - . . A4 C5 F5 - E5 - D5 - C5 -", // F
    "E5 - - - . . G4 C5 E5 - G5 - A5 - G5 E5", // C
    "D5 - - - - - - - B4 - D5 - G5 - - -", // G
  ];
  line(mix, lead.join(" "), six, 4 * 4 * beat, { type: "tri", voices: 2, detune: 0.004, vol: 0.16, attack: 0.03, decay: 0.3, sustain: 0.75, release: 0.2, cutoff: 0.7, vibrato: 0.006 });
  mix.echo(beat * 0.75, 0.32, 0.3);
  writeFileSync(new URL("music-main-modern.wav", outDir), mix.wav());
  console.log("wrote music-main-modern.wav", (bars * 4 * beat).toFixed(2) + "s");
}

/* ---------- boss theme: D minor, 140 BPM, driving sixteenth bass, stabs, toms ---------- */
{
  const bpm = 140;
  const beat = 60 / bpm;
  const six = beat / 4;
  const bars = 8;
  const mix = new Mix(bars * 4 * beat, true);
  const prog = [
    ["D2", ["D4", "F4", "A4"]],
    ["D2", ["D4", "F4", "A4"]],
    ["A#1", ["A#3", "D4", "F4"]],
    ["C2", ["C4", "E4", "G4"]],
    ["D2", ["D4", "F4", "A4"]],
    ["F2", ["F3", "A3", "C4"]],
    ["G2", ["G3", "A#3", "D4"]],
    ["A1", ["A3", "C#4", "E4"]],
  ];
  for (let b = 0; b < bars; b++) {
    const t0 = b * 4 * beat;
    const [root, tones] = prog[b];
    // Pulsing sixteenth bass, filter opening across the bar.
    for (let s = 0; s < 16; s++) {
      mix.voice(t0 + s * six, six * 0.8, freq(root), { type: "saw", voices: 2, detune: 0.008, vol: 0.16, attack: 0.002, decay: 0.07, sustain: 0.35, release: 0.03, cutoff: 0.2 + 0.25 * (s / 16) });
      if (s % 4 === 0) mix.voice(t0 + s * six, six * 3, freq(root) / 2, { type: "sine", voices: 1, vol: 0.28, attack: 0.003, decay: 0.15, sustain: 0.5, release: 0.05 });
    }
    // Brassy stabs on the off-beats.
    for (const at of [0.5, 1.5, 2.75, 3.5]) {
      for (const n of tones) mix.voice(t0 + at * beat, six * 1.6, freq(n), { type: "saw", voices: 4, detune: 0.01, vol: 0.05, attack: 0.004, decay: 0.12, sustain: 0.3, release: 0.08, cutoff: 0.6, cutoffEnd: 0.3 });
    }
    // Drums: kick on every beat, snare-clap on 2 and 4, fast hats, tom fill every 2 bars.
    for (let q = 0; q < 4; q++) {
      mix.kick(t0 + q * beat, 0.7);
      if (q % 2 === 1) {
        mix.clap(t0 + q * beat, 0.26);
        mix.noise(t0 + q * beat, 0.12, 0.18, 0.4);
      }
    }
    for (let s = 0; s < 16; s++) mix.hat(t0 + s * six, s % 2 ? 0.05 : 0.03);
    if (b % 2 === 1) [180, 150, 120, 95].forEach((f, k) => mix.tom(t0 + 3 * beat + k * six, f, 0.35));
  }
  // Menacing lead an octave up in the second half.
  const lead = [
    "D5 - - - A4 - D5 - F5 - E5 - D5 - C5 -",
    "D5 - - - - - - - A4 - C5 - D5 - F5 -",
    "F5 - - - D5 - F5 - A#5 - A5 - G5 - F5 -",
    "E5 - - - - - C#5 - E5 - A5 - G5 - E5 -",
  ];
  line(mix, lead.join(" "), six, 4 * 4 * beat, { type: "saw", voices: 3, detune: 0.006, vol: 0.1, attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.1, cutoff: 0.55, vibrato: 0.005 });
  mix.echo(beat * 0.5, 0.25, 0.22);
  writeFileSync(new URL("music-boss-modern.wav", outDir), mix.wav());
  console.log("wrote music-boss-modern.wav", (bars * 4 * beat).toFixed(2) + "s");
}

/* ---------- victory: a rising, triumphant swell ---------- */
{
  const mix = new Mix(3.2, false);
  // Bell-like melody.
  [["C5", 0], ["E5", 0.14], ["G5", 0.28], ["C6", 0.42]].forEach(([n, at]) =>
    mix.voice(at, 0.5, freq(n), { type: "sine", voices: 2, detune: 0.003, vol: 0.22, attack: 0.003, decay: 0.35, sustain: 0.2, release: 0.4, cutoff: 0.9 }),
  );
  // Big brassy chord swell underneath.
  for (const n of ["C3", "G3", "C4", "E4", "G4", "C5"])
    mix.voice(0.42, 2.2, freq(n), { type: "saw", voices: 5, detune: 0.012, vol: 0.06, attack: 0.25, decay: 1.2, sustain: 0.7, release: 0.6, cutoff: 0.3, cutoffEnd: 0.75 });
  mix.voice(0.42, 2.0, freq("C2"), { type: "sine", voices: 1, vol: 0.3, attack: 0.05, decay: 1, sustain: 0.6, release: 0.5 });
  mix.kick(0.42, 0.7);
  mix.noise(0.42, 1.2, 0.12, 0.6); // cymbal wash
  mix.echo(0.18, 0.3, 0.25);
  writeFileSync(new URL("victory-modern.wav", outDir), mix.wav());
  console.log("wrote victory-modern.wav");
}
