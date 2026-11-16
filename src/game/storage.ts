import AsyncStorage from "@react-native-async-storage/async-storage";

import { EMPTY_LIFETIME, type LifetimeStats, type Unlocked } from "./achievements";
import { DIFFICULTY_ORDER, type DifficultyId } from "./config";

const BEST = "typespeedy.best"; // per difficulty: typespeedy.best.easy, ...
const LEGACY_BEST = "typespeedy.best"; // before difficulties existed (counts as medium)
const MUTED = "typespeedy.muted";
const MUSIC = "typespeedy.music";
const DIFFICULTY = "typespeedy.difficulty";

export type BestScores = Record<DifficultyId, number>;

export async function loadPrefs(): Promise<{ best: BestScores; muted: boolean; music: boolean; difficulty: DifficultyId }> {
  const best: BestScores = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  try {
    const keys = [...DIFFICULTY_ORDER.map(d => `${BEST}.${d}`), LEGACY_BEST, MUTED, MUSIC, DIFFICULTY];
    const pairs = await AsyncStorage.multiGet(keys);
    const get = (k: string) => pairs.find(([key]) => key === k)?.[1] ?? null;
    for (const d of DIFFICULTY_ORDER) best[d] = Number(get(`${BEST}.${d}`)) || 0;
    best.medium = Math.max(best.medium, Number(get(LEGACY_BEST)) || 0);
    const saved = get(DIFFICULTY) as DifficultyId | null;
    return {
      best,
      muted: get(MUTED) === "1",
      music: get(MUSIC) !== "0", // on unless turned off
      difficulty: saved && DIFFICULTY_ORDER.includes(saved) ? saved : "medium",
    };
  } catch {
    return { best, muted: false, music: true, difficulty: "medium" };
  }
}

export function saveBest(difficulty: DifficultyId, score: number) {
  AsyncStorage.setItem(`${BEST}.${difficulty}`, String(score)).catch(() => {});
}

export function saveMuted(muted: boolean) {
  AsyncStorage.setItem(MUTED, muted ? "1" : "0").catch(() => {});
}

export function saveDifficulty(difficulty: DifficultyId) {
  AsyncStorage.setItem(DIFFICULTY, difficulty).catch(() => {});
}

export function saveMusic(on: boolean) {
  AsyncStorage.setItem(MUSIC, on ? "1" : "0").catch(() => {});
}

/* ---------- Daily Challenge ---------- */

const DAILY = "typespeedy.daily"; // the most recent daily attempt
const DAILY_STREAK = "typespeedy.dailyStreak";

export type DailyRecord = {
  date: string; // "2026-11-16"
  score: number;
  round: number;
  finished: boolean; // false while the run is in progress (or if the app closed mid-run)
};

export type DailyStreak = { count: number; lastDate: string };

export async function loadDaily(): Promise<{ record: DailyRecord | null; streak: DailyStreak }> {
  try {
    const [r, s] = await Promise.all([AsyncStorage.getItem(DAILY), AsyncStorage.getItem(DAILY_STREAK)]);
    return {
      record: r ? (JSON.parse(r) as DailyRecord) : null,
      streak: s ? (JSON.parse(s) as DailyStreak) : { count: 0, lastDate: "" },
    };
  } catch {
    return { record: null, streak: { count: 0, lastDate: "" } };
  }
}

export function saveDaily(record: DailyRecord) {
  AsyncStorage.setItem(DAILY, JSON.stringify(record)).catch(() => {});
}

export function saveDailyStreak(streak: DailyStreak) {
  AsyncStorage.setItem(DAILY_STREAK, JSON.stringify(streak)).catch(() => {});
}

/* ---------- Achievements ---------- */

const ACHIEVEMENTS_KEY = "typespeedy.achievements"; // id -> date unlocked
const LIFETIME_KEY = "typespeedy.lifetime"; // totals across every game

export async function loadAchievements(): Promise<{ unlocked: Unlocked; lifetime: LifetimeStats }> {
  try {
    const [a, l] = await Promise.all([AsyncStorage.getItem(ACHIEVEMENTS_KEY), AsyncStorage.getItem(LIFETIME_KEY)]);
    return {
      unlocked: a ? (JSON.parse(a) as Unlocked) : {},
      lifetime: l ? { ...EMPTY_LIFETIME, ...(JSON.parse(l) as Partial<LifetimeStats>) } : EMPTY_LIFETIME,
    };
  } catch {
    return { unlocked: {}, lifetime: EMPTY_LIFETIME };
  }
}

export function saveAchievements(unlocked: Unlocked) {
  AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked)).catch(() => {});
}

export function saveLifetime(lifetime: LifetimeStats) {
  AsyncStorage.setItem(LIFETIME_KEY, JSON.stringify(lifetime)).catch(() => {});
}
