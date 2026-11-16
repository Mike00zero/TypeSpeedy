// Generates TypeSpeedy's original chiptune music as WAV files in assets/music.
//   music-main.wav   – upbeat retro loop for normal rounds (C major, 132 BPM, 8 bars)
//   music-boss.wav   – faster, darker loop for boss fights (A minor, 156 BPM, 8 bars)
//   victory.wav      – short fanfare when a boss is defeated
// Run with: node scripts/make-music.mjs
import { mkdirSync, writeFileSync } from "node:fs";

const RATE = 22050;
const outDir = new URL("../assets/music/", import.meta.url);
mkdirSync(outDir, { recursive: true });

/* ---------- notes ---------- */
const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
/** "A4" -> 440 Hz */
function freq(name) {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}
const shift = (name, semis) => {
  const m = /^([A-G]#?)(-?\d)$/.exec(name);
  const midi = (Number(m[2]) + 1) * 12 + NOTE[m[1]] + semis;
  const names = Object.keys(NOTE);
  return `${names[midi % 12]}${Math.floor(midi / 12) - 1}`;
};

/* ---------- synthesis ---------- */
const osc = {
  square: (p, duty = 0.5) => (p % 1 < duty ? 1 : -1),
  triangle: p => 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25)),
  saw: p => 2 * (p % 1) - 1,
  sine: p => Math.sin(2 * Math.PI * p),
};

class Mix {
  constructor(seconds, loop) {
    this.n = Math.round(seconds * RATE);
    this.buf = new Float32Array(this.n);
    this.loop = loop; // wrap tails to the start so the loop is seamless
  }
  add(i, v) {
    if (i >= this.n) {
      if (!this.loop) return;
      i %= this.n;
    }
    this.buf[i] += v;
  }
  /** A pitched note with a short attack, gentle decay and release. */
  tone(at, dur, f, { wave = "square", duty = 0.5, vol = 0.2, sustain = 0.65, slideTo } = {}) {
    const start = Math.round(at * RATE);
    const len = Math.round(dur * RATE);
    const rel = Math.round(0.03 * RATE);
    let phase = 0;
    for (let i = 0; i < len + rel; i++) {
      const t = i / len;
      const fNow = slideTo ? f * Math.pow(slideTo / f, Math.min(1, t)) : f;
      phase += fNow / RATE;
      const attack = Math.min(1, i / (RATE * 0.005));
      const body = sustain + (1 - sustain) * Math.exp(-6 * t);
      const release = i < len ? 1 : 1 - (i - len) / rel;
      const s = wave === "square" ? osc.square(phase, duty) : osc[wave](phase);
      this.add(start + i, s * vol * attack * body * release);
    }
  }
  kick(at, vol = 0.55) {
    const start = Math.round(at * RATE);
    const len = Math.round(0.22 * RATE);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      phase += (150 * Math.pow(45 / 150, Math.min(1, t * 2.5))) / RATE;
      this.add(start + i, osc.sine(phase) * vol * Math.pow(1 - t, 2));
    }
  }
  noise(at, dur, vol, bright = true) {
    const start = Math.round(at * RATE);
    const len = Math.round(dur * RATE);
    let prev = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      const s = bright ? w - prev : (w + prev) / 2; // crude high-pass / low-pass
      prev = w;
      this.add(start + i, s * vol * Math.pow(1 - i / len, 3));
    }
  }
  snare(at, vol = 0.32) {
    this.noise(at, 0.14, vol, false);
    this.tone(at, 0.06, 190, { wave: "triangle", vol: vol * 0.6, sustain: 0.2 });
  }
  hat(at, vol = 0.07, open = false) {
    this.noise(at, open ? 0.09 : 0.03, vol, true);
  }
  wav() {
    let peak = 0;
    for (const v of this.buf) peak = Math.max(peak, Math.abs(v));
    const gain = peak > 0 ? 0.9 / peak : 1;
    const data = Buffer.alloc(this.n * 2);
    this.buf.forEach((v, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, v * gain)) * 32767), i * 2));
    const h = Buffer.alloc(44);
    h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
    h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
    h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
    h.write("data", 36); h.writeUInt32LE(data.length, 40);
    return Buffer.concat([h, data]);
  }
}

/**
 * Plays a line written as space-separated steps: a note ("E5"), "-" to hold the previous note,
 * or "." for a rest.
 */
function line(mix, steps, stepDur, startAt, opts) {
  const tokens = steps.trim().split(/\s+/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (tok === "-" || tok === ".") continue;
    let len = 1;
    while (tokens[i + len] === "-") len++;
    mix.tone(startAt + i * stepDur, len * stepDur * 0.92, freq(tok), opts);
  }
}

/* ---------- main theme: C major, 132 BPM, eighth-note grid ---------- */
{
  const bpm = 132;
  const eighth = 60 / bpm / 2;
  const bars = 8;
  const mix = new Mix(bars * 8 * eighth, true);

  const lead = [
    "E5 - G5 - C6 - G5 E5", // C
    "A5 - C6 - E6 - D6 C6", // Am
    "A5 - F5 - A5 C6 - A5", // F
    "G5 - - - D5 - G5 -", // G
    "E5 G5 C6 G5 E6 - D6 C6", // C
    "C6 - A5 - E5 - A5 C6", // Am
    "D6 - F6 - E6 D6 C6 A5", // Dm
    "B5 - G5 - D6 - - -", // G
  ];
  line(mix, lead.join(" "), eighth, 0, { wave: "square", duty: 0.25, vol: 0.16 });
  // A quieter echo of the lead, one eighth late and an octave down, for width.
  line(mix, lead.join(" ").replace(/([A-G]#?)(\d)/g, (_, n, o) => `${n}${o - 1}`), eighth, eighth, {
    wave: "square",
    duty: 0.125,
    vol: 0.05,
  });

  const chords = [
    ["C", ["C4", "E4", "G4"]],
    ["A", ["A3", "C4", "E4"]],
    ["F", ["F3", "A3", "C4"]],
    ["G", ["G3", "B3", "D4"]],
    ["C", ["C4", "E4", "G4"]],
    ["A", ["A3", "C4", "E4"]],
    ["D", ["D4", "F4", "A4"]],
    ["G", ["G3", "B3", "D4"]],
  ];
  const roots = ["C2", "A1", "F1", "G1", "C2", "A1", "D2", "G1"];
  for (let b = 0; b < bars; b++) {
    const t0 = b * 8 * eighth;
    for (let s = 0; s < 8; s++) {
      // bass: root / octave bounce
      const note = s % 2 === 0 ? roots[b] : shift(roots[b], 12);
      mix.tone(t0 + s * eighth, eighth * 0.8, freq(note), { wave: "triangle", vol: 0.32, sustain: 0.8 });
      // soft arpeggio
      const tones = chords[b][1];
      mix.tone(t0 + s * eighth, eighth * 0.6, freq(tones[[0, 1, 2, 1][s % 4]]), {
        wave: "square",
        duty: 0.125,
        vol: 0.045,
        sustain: 0.4,
      });
      // drums
      if (s === 0 || s === 4) mix.kick(t0 + s * eighth);
      if (s === 2 || s === 6) mix.snare(t0 + s * eighth);
      mix.hat(t0 + s * eighth + (s % 2 ? 0 : 0), s % 2 ? 0.08 : 0.05, s === 7);
    }
  }
  writeFileSync(new URL("music-main.wav", outDir), mix.wav());
  console.log("wrote music-main.wav", (bars * 8 * eighth).toFixed(2) + "s");
}

/* ---------- boss theme: A minor, 156 BPM, sixteenth-note grid ---------- */
{
  const bpm = 156;
  const six = 60 / bpm / 4;
  const bars = 8;
  const mix = new Mix(bars * 16 * six, true);

  // Lead written in eighths, so each step is two sixteenths.
  const lead = [
    "A5 - - E5 A5 B5 C6 B5", // Am
    "A5 - E5 - C5 - E5 -", // Am
    "F5 - A5 C6 - A5 F5 -", // F
    "G5 - B5 D6 - B5 G5 -", // G
    "A5 - - E5 A5 B5 C6 D6", // Am
    "E6 - D6 C6 B5 C6 A5 -", // Am
    "D6 - F6 - E6 D6 C6 A5", // Dm
    "G#5 - B5 - E6 - D6 B5", // E
  ];
  line(mix, lead.join(" "), six * 2, 0, { wave: "saw", vol: 0.11, sustain: 0.7 });
  line(mix, lead.join(" "), six * 2, 0, { wave: "square", duty: 0.25, vol: 0.07, sustain: 0.6 });

  const roots = ["A1", "A1", "F1", "G1", "A1", "A1", "D2", "E1"];
  const fifths = ["E2", "E2", "C2", "D2", "E2", "E2", "A2", "B1"];
  for (let b = 0; b < bars; b++) {
    const t0 = b * 16 * six;
    for (let s = 0; s < 16; s++) {
      const t = t0 + s * six;
      // driving sixteenth bass with an octave pop every fourth step
      const note = s % 4 === 3 ? shift(roots[b], 12) : roots[b];
      mix.tone(t, six * 0.75, freq(note), { wave: "square", duty: 0.5, vol: 0.13, sustain: 0.5 });
      // power-chord stabs on the offbeat accents
      if (s === 0 || s === 6 || s === 10) {
        mix.tone(t, six * 1.6, freq(shift(roots[b], 24)), { wave: "saw", vol: 0.06, sustain: 0.3 });
        mix.tone(t, six * 1.6, freq(shift(fifths[b], 24)), { wave: "saw", vol: 0.05, sustain: 0.3 });
      }
      // drums: four on the floor, backbeat snare, busy hats
      if (s % 4 === 0 || s === 14) mix.kick(t, 0.6);
      if (s === 4 || s === 12) mix.snare(t, 0.36);
      if (b % 4 === 3 && s >= 12) mix.snare(t, 0.22); // fill into the next phrase
      mix.hat(t, s % 2 ? 0.05 : 0.08);
    }
  }
  writeFileSync(new URL("music-boss.wav", outDir), mix.wav());
  console.log("wrote music-boss.wav", (bars * 16 * six).toFixed(2) + "s");
}

/* ---------- victory fanfare ---------- */
{
  const mix = new Mix(3.0, false);
  const q = 0.075;
  ["G4", "C5", "E5", "G5"].forEach((n, i) => mix.tone(i * q, q * 0.9, freq(n), { duty: 0.25, vol: 0.2 }));
  mix.tone(4 * q, 0.42, freq("C6"), { duty: 0.25, vol: 0.22, sustain: 0.8 });
  const t1 = 4 * q + 0.5;
  ["A5", "B5"].forEach((n, i) => mix.tone(t1 + i * q * 1.4, q * 1.3, freq(n), { duty: 0.25, vol: 0.2 }));
  const t2 = t1 + 2 * q * 1.4;
  for (const n of ["C5", "E5", "G5", "C6"]) mix.tone(t2, 1.3, freq(n), { duty: 0.25, vol: 0.12, sustain: 0.75 });
  mix.tone(t2, 1.3, freq("C3"), { wave: "triangle", vol: 0.35, sustain: 0.8 });
  mix.tone(0, 4 * q + 0.42, freq("C3"), { wave: "triangle", vol: 0.3, sustain: 0.8 });
  // drum roll into a crash-like burst
  for (let i = 0; i < 6; i++) mix.snare(t1 - 0.25 + i * 0.04, 0.14);
  mix.kick(t2, 0.6);
  mix.noise(t2, 0.9, 0.18, true);
  writeFileSync(new URL("victory.wav", outDir), mix.wav());
  console.log("wrote victory.wav");
}
