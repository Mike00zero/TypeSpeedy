// Generates the game's sound effects as small WAV files in assets/sounds.
// Run with: node scripts/make-sounds.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const RATE = 22050;
const outDir = new URL("../assets/sounds/", import.meta.url);
mkdirSync(outDir, { recursive: true });

const waves = {
  sine: p => Math.sin(2 * Math.PI * p),
  triangle: p => 1 - 4 * Math.abs(Math.round(p - 0.25) - (p - 0.25)),
  square: p => (p % 1 < 0.5 ? 1 : -1),
  sawtooth: p => 2 * (p % 1) - 1,
};

// notes: [{ at, freq, dur, type, vol, slideTo }]
function render(notes) {
  const end = Math.max(...notes.map(n => n.at + n.dur)) + 0.02;
  const buf = new Float32Array(Math.ceil(end * RATE));
  for (const n of notes) {
    const start = Math.floor(n.at * RATE), len = Math.floor(n.dur * RATE);
    let phase = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const f = n.slideTo ? n.freq * Math.pow(n.slideTo / n.freq, t) : n.freq;
      phase += f / RATE;
      const attack = Math.min(1, i / (RATE * 0.004));
      const env = attack * Math.pow(1 - t, 2);
      buf[start + i] += waves[n.type](phase) * n.vol * env;
    }
  }
  return buf;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  samples.forEach((s, i) => data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), i * 2));
  const h = Buffer.alloc(44);
  h.write("RIFF", 0); h.writeUInt32LE(36 + data.length, 4); h.write("WAVE", 8);
  h.write("fmt ", 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(RATE, 24); h.writeUInt32LE(RATE * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write("data", 36); h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

const sounds = {
  key: [{ at: 0, freq: 880, dur: 0.04, type: "triangle", vol: 0.25 }],
  miss: [{ at: 0, freq: 180, dur: 0.28, type: "sawtooth", vol: 0.5, slideTo: 70 }],
  word: [
    { at: 0, freq: 660, dur: 0.09, type: "triangle", vol: 0.45 },
    { at: 0.07, freq: 990, dur: 0.12, type: "triangle", vol: 0.45 },
  ],
  timeout: [{ at: 0, freq: 240, dur: 0.4, type: "square", vol: 0.3, slideTo: 90 }],
  round: [523, 659, 784].map((freq, i) => ({ at: i * 0.09, freq, dur: 0.16, type: "triangle", vol: 0.45 })),
  over: [392, 330, 262, 196].map((freq, i) => ({ at: i * 0.16, freq, dur: 0.3, type: "sawtooth", vol: 0.3 })),
};

for (const [name, notes] of Object.entries(sounds)) {
  writeFileSync(new URL(`${name}.wav`, outDir), toWav(render(notes)));
  console.log("wrote", name + ".wav");
}
