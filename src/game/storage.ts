import AsyncStorage from "@react-native-async-storage/async-storage";

import { DIFFICULTY_ORDER, type DifficultyId } from "./config";

const BEST = "typespeedy.best"; // per difficulty: typespeedy.best.easy, ...
const LEGACY_BEST = "typespeedy.best"; // before difficulties existed (counts as medium)
const MUTED = "typespeedy.muted";
const DIFFICULTY = "typespeedy.difficulty";

export type BestScores = Record<DifficultyId, number>;

export async function loadPrefs(): Promise<{ best: BestScores; muted: boolean; difficulty: DifficultyId }> {
  const best: BestScores = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  try {
    const keys = [...DIFFICULTY_ORDER.map(d => `${BEST}.${d}`), LEGACY_BEST, MUTED, DIFFICULTY];
    const pairs = await AsyncStorage.multiGet(keys);
    const get = (k: string) => pairs.find(([key]) => key === k)?.[1] ?? null;
    for (const d of DIFFICULTY_ORDER) best[d] = Number(get(`${BEST}.${d}`)) || 0;
    best.medium = Math.max(best.medium, Number(get(LEGACY_BEST)) || 0);
    const saved = get(DIFFICULTY) as DifficultyId | null;
    return {
      best,
      muted: get(MUTED) === "1",
      difficulty: saved && DIFFICULTY_ORDER.includes(saved) ? saved : "medium",
    };
  } catch {
    return { best, muted: false, difficulty: "medium" };
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
