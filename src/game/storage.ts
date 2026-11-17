import AsyncStorage from "@react-native-async-storage/async-storage";

// Saved data keys start with "typespeedy." (the app's first name). They stay that way on purpose,
// so renaming the app never wipes anyone's progress, achievements or Pro.

import { EMPTY_LIFETIME, pruneUnlocked, type LifetimeStats, type Unlocked } from "./achievements";
import { DIFFICULTY_ORDER, type DifficultyId } from "./config";
import { PACK_BY_ID, THEME_BY_ID, type PackId, type ThemeId } from "./unlocks";
import { EMPTY_TOWER, type TowerProgress } from "./tower";
import { EMPTY_TRIALS, type ProTrials } from "./pro";
import { EMPTY_REVIEW, type ReviewState } from "./review";
import { DEFAULT_REMINDER_HOUR } from "./reminders";
import {
  EMPTY_MIX,
  EMPTY_RUSH,
  EMPTY_SPRINT,
  EMPTY_ZEN,
  MODE_BY_ID,
  type GameMode,
  type MixBest,
  type RushBest,
  type SprintBest,
  type ZenBest,
} from "./modes";

const BEST = "typespeedy.best"; // per difficulty: typespeedy.best.easy, ...
const LEGACY_BEST = "typespeedy.best"; // before difficulties existed (counts as medium)
const MUTED = "typespeedy.muted";
const MUSIC = "typespeedy.music";
const DIFFICULTY = "typespeedy.difficulty";
const THEME = "typespeedy.theme";
const PACK = "typespeedy.pack";
const HAPTICS = "typespeedy.haptics";
const EFFECTS = "typespeedy.effects"; // screen shake and red flash on a miss
const MODE = "typespeedy.mode";
const TOWER_KEY = "typespeedy.tower";
const SPRINT_KEY = "typespeedy.sprint";
const ZEN_KEY = "typespeedy.zen";
const RUSH_KEY = "typespeedy.rush";
const SUDDEN_KEY = "typespeedy.sudden"; // Sudden Death best score per difficulty
const MIX_KEY = "typespeedy.mix";
const PRO_KEY = "typespeedy.pro"; // a local copy of Pro ownership (the store is the source of truth)
const TRIALS_KEY = "typespeedy.proTrials";
const REVIEW_KEY = "typespeedy.review";
const REMINDER_KEY = "typespeedy.reminder";

export type BestScores = Record<DifficultyId, number>;

type Prefs = {
  best: BestScores;
  muted: boolean;
  music: boolean;
  difficulty: DifficultyId;
  theme: ThemeId;
  pack: PackId;
  haptics: boolean;
  effects: boolean;
  mode: GameMode;
};

export async function loadPrefs(): Promise<Prefs> {
  const best: BestScores = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  try {
    const keys = [...DIFFICULTY_ORDER.map(d => `${BEST}.${d}`), LEGACY_BEST, MUTED, MUSIC, DIFFICULTY, THEME, PACK, HAPTICS, EFFECTS, MODE];
    const pairs = await AsyncStorage.multiGet(keys);
    const get = (k: string) => pairs.find(([key]) => key === k)?.[1] ?? null;
    for (const d of DIFFICULTY_ORDER) best[d] = Number(get(`${BEST}.${d}`)) || 0;
    best.medium = Math.max(best.medium, Number(get(LEGACY_BEST)) || 0);
    const saved = get(DIFFICULTY) as DifficultyId | null;
    const theme = get(THEME) as ThemeId | null;
    const pack = get(PACK) as PackId | null;
    return {
      best,
      muted: get(MUTED) === "1",
      music: get(MUSIC) !== "0", // on unless turned off
      difficulty: saved && DIFFICULTY_ORDER.includes(saved) ? saved : "medium",
      theme: theme && THEME_BY_ID[theme] ? theme : "classic",
      pack: pack && PACK_BY_ID[pack] ? pack : "classic",
      haptics: get(HAPTICS) !== "0", // on unless turned off
      effects: get(EFFECTS) !== "0",
      mode: MODE_BY_ID[get(MODE) as GameMode] ? (get(MODE) as GameMode) : "classic",
    };
  } catch {
    return { best, muted: false, music: true, difficulty: "medium", theme: "classic", pack: "classic", haptics: true, effects: true, mode: "classic" };
  }
}

export function saveMode(mode: GameMode) {
  AsyncStorage.setItem(MODE, mode).catch(() => {});
}

export async function loadTower(): Promise<TowerProgress> {
  try {
    const t = await AsyncStorage.getItem(TOWER_KEY);
    return t ? { ...EMPTY_TOWER, ...(JSON.parse(t) as Partial<TowerProgress>) } : EMPTY_TOWER;
  } catch {
    return EMPTY_TOWER;
  }
}

export async function loadSprint(): Promise<SprintBest> {
  try {
    const t = await AsyncStorage.getItem(SPRINT_KEY);
    return t ? { ...EMPTY_SPRINT, ...(JSON.parse(t) as Partial<SprintBest>) } : EMPTY_SPRINT;
  } catch {
    return EMPTY_SPRINT;
  }
}

export type ReminderPrefs = { on: boolean; hour: number; asked: boolean }; // asked: the game-over offer was shown
const EMPTY_REMINDER: ReminderPrefs = { on: false, hour: DEFAULT_REMINDER_HOUR, asked: false };

export async function loadExtras(): Promise<{ review: ReviewState; reminder: ReminderPrefs }> {
  try {
    const [r, m] = await Promise.all([AsyncStorage.getItem(REVIEW_KEY), AsyncStorage.getItem(REMINDER_KEY)]);
    return {
      review: r ? { ...EMPTY_REVIEW, ...(JSON.parse(r) as Partial<ReviewState>) } : EMPTY_REVIEW,
      reminder: m ? { ...EMPTY_REMINDER, ...(JSON.parse(m) as Partial<ReminderPrefs>) } : EMPTY_REMINDER,
    };
  } catch {
    return { review: EMPTY_REVIEW, reminder: EMPTY_REMINDER };
  }
}

export function saveReview(r: ReviewState) {
  AsyncStorage.setItem(REVIEW_KEY, JSON.stringify(r)).catch(() => {});
}

export function saveReminder(r: ReminderPrefs) {
  AsyncStorage.setItem(REMINDER_KEY, JSON.stringify(r)).catch(() => {});
}

export async function loadPro(): Promise<{ pro: boolean; trials: ProTrials }> {
  try {
    const [p, t] = await Promise.all([AsyncStorage.getItem(PRO_KEY), AsyncStorage.getItem(TRIALS_KEY)]);
    return { pro: p === "1", trials: t ? { ...EMPTY_TRIALS, ...(JSON.parse(t) as Partial<ProTrials>) } : EMPTY_TRIALS };
  } catch {
    return { pro: false, trials: EMPTY_TRIALS };
  }
}

export function savePro(pro: boolean) {
  AsyncStorage.setItem(PRO_KEY, pro ? "1" : "0").catch(() => {});
}

export function saveTrials(t: ProTrials) {
  AsyncStorage.setItem(TRIALS_KEY, JSON.stringify(t)).catch(() => {});
}

export async function loadMix(): Promise<MixBest> {
  try {
    const t = await AsyncStorage.getItem(MIX_KEY);
    return t ? { ...EMPTY_MIX, ...(JSON.parse(t) as Partial<MixBest>) } : EMPTY_MIX;
  } catch {
    return EMPTY_MIX;
  }
}

export function saveMix(b: MixBest) {
  AsyncStorage.setItem(MIX_KEY, JSON.stringify(b)).catch(() => {});
}

export async function loadSudden(): Promise<BestScores> {
  const empty: BestScores = { easy: 0, medium: 0, hard: 0, impossible: 0 };
  try {
    const t = await AsyncStorage.getItem(SUDDEN_KEY);
    return t ? { ...empty, ...(JSON.parse(t) as Partial<BestScores>) } : empty;
  } catch {
    return empty;
  }
}

export function saveSudden(b: BestScores) {
  AsyncStorage.setItem(SUDDEN_KEY, JSON.stringify(b)).catch(() => {});
}

export async function loadRush(): Promise<RushBest> {
  try {
    const t = await AsyncStorage.getItem(RUSH_KEY);
    return t ? { ...EMPTY_RUSH, ...(JSON.parse(t) as Partial<RushBest>) } : EMPTY_RUSH;
  } catch {
    return EMPTY_RUSH;
  }
}

export function saveRush(b: RushBest) {
  AsyncStorage.setItem(RUSH_KEY, JSON.stringify(b)).catch(() => {});
}

export async function loadZen(): Promise<ZenBest> {
  try {
    const t = await AsyncStorage.getItem(ZEN_KEY);
    return t ? { ...EMPTY_ZEN, ...(JSON.parse(t) as Partial<ZenBest>) } : EMPTY_ZEN;
  } catch {
    return EMPTY_ZEN;
  }
}

export function saveZen(b: ZenBest) {
  AsyncStorage.setItem(ZEN_KEY, JSON.stringify(b)).catch(() => {});
}

export function saveSprint(b: SprintBest) {
  AsyncStorage.setItem(SPRINT_KEY, JSON.stringify(b)).catch(() => {});
}

export function saveTower(t: TowerProgress) {
  AsyncStorage.setItem(TOWER_KEY, JSON.stringify(t)).catch(() => {});
}

export function saveHaptics(on: boolean) {
  AsyncStorage.setItem(HAPTICS, on ? "1" : "0").catch(() => {});
}

export function saveEffects(on: boolean) {
  AsyncStorage.setItem(EFFECTS, on ? "1" : "0").catch(() => {});
}

/** Settings > Reset stats: best scores, lifetime totals and Tower progress. Today's Daily try stays used. */
export function resetStats() {
  AsyncStorage.multiRemove([...DIFFICULTY_ORDER.map(d => `${BEST}.${d}`), LEGACY_BEST, LIFETIME_KEY, TOWER_KEY, SPRINT_KEY, ZEN_KEY, RUSH_KEY, SUDDEN_KEY, MIX_KEY]).catch(() => {});
}

/** Settings > Reset achievements (themes and word packs they unlocked go back to Classic). */
export function resetAchievements() {
  AsyncStorage.multiRemove([ACHIEVEMENTS_KEY, THEME, PACK]).catch(() => {});
}

export function saveTheme(theme: ThemeId) {
  AsyncStorage.setItem(THEME, theme).catch(() => {});
}

export function savePack(pack: PackId) {
  AsyncStorage.setItem(PACK, pack).catch(() => {});
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
      unlocked: a ? pruneUnlocked(JSON.parse(a) as Unlocked) : {},
      lifetime: l ? mergeLifetime(JSON.parse(l) as Partial<LifetimeStats>) : EMPTY_LIFETIME,
    };
  } catch {
    return { unlocked: {}, lifetime: EMPTY_LIFETIME };
  }
}

/** Fills in fields an older save doesn't have. */
function mergeLifetime(saved: Partial<LifetimeStats>): LifetimeStats {
  return {
    ...EMPTY_LIFETIME,
    ...saved,
    gamesByDifficulty: { ...EMPTY_LIFETIME.gamesByDifficulty, ...saved.gamesByDifficulty },
  };
}

export function saveAchievements(unlocked: Unlocked) {
  AsyncStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(unlocked)).catch(() => {});
}

export function saveLifetime(lifetime: LifetimeStats) {
  AsyncStorage.setItem(LIFETIME_KEY, JSON.stringify(lifetime)).catch(() => {});
}
