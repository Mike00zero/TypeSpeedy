/**
 * Daily Challenge helpers: a date key, and seeded random numbers so everyone playing on the
 * same day gets the same words, bosses and power-up drops, with no server needed.
 */
import { DIFFICULTIES } from "./config";

/** Daily challenges are always played on these rules, so scores are comparable. */
export const DAILY_DIFFICULTY = DIFFICULTIES.medium;

/** Today's date on this phone as "2026-11-16" (the challenge changes at local midnight). */
export function todayKey(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function yesterdayKey(now = new Date()): string {
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  return todayKey(y);
}

/** "2026-11-16" -> "Nov 16" */
export function prettyDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** "5h 12m" until local midnight. */
export function timeUntilTomorrow(now = new Date()): string {
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const mins = Math.max(1, Math.round((midnight.getTime() - now.getTime()) / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? `${h}h ${mins % 60}m` : `${mins}m`;
}

/** FNV-1a: turns a string into a 32-bit seed. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: a small, fast seeded random number generator returning 0 <= n < 1. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type RandomStreams = {
  words: () => number;
  bosses: () => number;
  powerups: () => number;
  bonus: () => number;
};

/**
 * Separate random streams for each kind of pick, so (for example) earning a power-up earlier
 * than someone else doesn't change which words you get.
 */
export function dailyStreams(dateKey: string): RandomStreams {
  return {
    words: mulberry32(hash(`typespeedy:${dateKey}:words`)),
    bosses: mulberry32(hash(`typespeedy:${dateKey}:bosses`)),
    powerups: mulberry32(hash(`typespeedy:${dateKey}:powerups`)),
    bonus: mulberry32(hash(`typespeedy:${dateKey}:bonus`)),
  };
}

export function freeStreams(): RandomStreams {
  return { words: Math.random, bosses: Math.random, powerups: Math.random, bonus: Math.random };
}
