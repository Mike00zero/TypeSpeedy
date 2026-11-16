/**
 * Achievements: one-time goals that unlock during play and stay unlocked.
 * Some are about a single game ("reach round 10"), some add up across every game ("type 500 words").
 */
import { DIFFICULTY_ORDER, type DifficultyId } from "./config";

/** What happened in the current game so far. */
export type RunStats = {
  difficulty: DifficultyId;
  daily: boolean;
  over: boolean; // the game has ended
  score: number;
  round: number; // the round being played
  wordsTyped: number;
  bestStreak: number;
  bossesDefeated: number;
  flawlessBosses: number; // bosses beaten without a wrong letter or timeout
  clutchBosses: number; // bosses beaten with one life left (not on Impossible)
  perfectRounds: number; // rounds (boss included) with no wrong letters or timeouts
  powerUpsUsed: number; // includes gold bonuses
  bonusesUsed: number;
  shieldBlocks: number;
  bucketFilled: boolean;
  fastest: number | null; // seconds, any word
  fastestLong: number | null; // seconds, a 7-letter word
  keys: number;
  goodKeys: number;
};

/** Totals across every finished game. */
export type LifetimeStats = {
  games: number;
  words: number;
  bosses: number;
  powerUps: number;
  bossDifficulties: DifficultyId[]; // difficulties a boss has been beaten on
};

export const EMPTY_LIFETIME: LifetimeStats = { games: 0, words: 0, bosses: 0, powerUps: 0, bossDifficulties: [] };

export function emptyRun(difficulty: DifficultyId = "medium"): RunStats {
  return {
    difficulty,
    daily: false,
    over: false,
    score: 0,
    round: 0,
    wordsTyped: 0,
    bestStreak: 0,
    bossesDefeated: 0,
    flawlessBosses: 0,
    clutchBosses: 0,
    perfectRounds: 0,
    powerUpsUsed: 0,
    bonusesUsed: 0,
    shieldBlocks: 0,
    bucketFilled: false,
    fastest: null,
    fastestLong: null,
    keys: 0,
    goodKeys: 0,
  };
}

/** Lifetime totals with the current game added in (so lifetime goals can unlock mid-game). */
export function addRun(life: LifetimeStats, run: RunStats | null): LifetimeStats {
  if (!run) return life;
  const diffs = new Set(life.bossDifficulties);
  if (run.bossesDefeated > 0) diffs.add(run.difficulty);
  return {
    games: life.games + 1,
    words: life.words + run.wordsTyped,
    bosses: life.bosses + run.bossesDefeated,
    powerUps: life.powerUps + run.powerUpsUsed,
    bossDifficulties: DIFFICULTY_ORDER.filter(d => diffs.has(d)),
  };
}

export type AchievementContext = {
  run: RunStats; // emptyRun() when not in a game
  life: LifetimeStats; // already includes the current game
  dailyStreak: number;
};

export type AchievementGroup = "Getting started" | "Score" | "Rounds" | "Combos" | "Bosses" | "Speed" | "Power-ups" | "Difficulty" | "Daily" | "Career";

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  "Getting started",
  "Score",
  "Rounds",
  "Combos",
  "Bosses",
  "Speed",
  "Power-ups",
  "Difficulty",
  "Daily",
  "Career",
];

export type Achievement = {
  id: string;
  name: string;
  desc: string;
  group: AchievementGroup;
  /** [current, goal]. Unlocks when current reaches goal. Shown as a progress bar for long goals. */
  progress: (x: AchievementContext) => [number, number];
  /** Show the progress bar on the list (for goals that build up over time). */
  showProgress?: boolean;
};

const goal = (cur: number, target: number): [number, number] => [Math.min(cur, target), target];
const yes = (ok: boolean): [number, number] => [ok ? 1 : 0, 1];
const reachedRound = (r: RunStats) => r.round; // being on round N means N-1 rounds were cleared

export const ACHIEVEMENTS: Achievement[] = [
  // Getting started
  { id: "first_word", name: "First Words", desc: "Finish your first word.", group: "Getting started", progress: x => yes(x.run.wordsTyped >= 1) },
  { id: "first_boss", name: "Boss Slayer", desc: "Beat your first boss.", group: "Getting started", progress: x => yes(x.run.bossesDefeated >= 1) },
  { id: "first_powerup", name: "Powered Up", desc: "Use a power-up.", group: "Getting started", progress: x => yes(x.run.powerUpsUsed >= 1) },

  // Score in one game
  { id: "score_1k", name: "Four Digits", desc: "Score 1,000 points in one game.", group: "Score", progress: x => goal(x.run.score, 1000) },
  { id: "score_5k", name: "High Scorer", desc: "Score 5,000 points in one game.", group: "Score", progress: x => goal(x.run.score, 5000) },
  { id: "score_10k", name: "Five Digits", desc: "Score 10,000 points in one game.", group: "Score", progress: x => goal(x.run.score, 10000) },
  { id: "score_25k", name: "Hall of Fame", desc: "Score 25,000 points in one game.", group: "Score", progress: x => goal(x.run.score, 25000) },

  // Rounds
  { id: "round_3", name: "Warming Up", desc: "Reach round 3.", group: "Rounds", progress: x => goal(reachedRound(x.run), 3) },
  { id: "round_5", name: "Picking Up Speed", desc: "Reach round 5.", group: "Rounds", progress: x => goal(reachedRound(x.run), 5) },
  { id: "round_10", name: "Double Digits", desc: "Reach round 10.", group: "Rounds", progress: x => goal(reachedRound(x.run), 10) },
  { id: "round_15", name: "Unstoppable", desc: "Reach round 15.", group: "Rounds", progress: x => goal(reachedRound(x.run), 15) },
  { id: "round_20", name: "Top Speed", desc: "Reach round 20.", group: "Rounds", progress: x => goal(reachedRound(x.run), 20) },
  { id: "perfect_round", name: "Perfect Round", desc: "Clear a whole round, boss included, with no wrong letters or timeouts.", group: "Rounds", progress: x => yes(x.run.perfectRounds >= 1) },
  { id: "perfect_3", name: "Clean Sweep", desc: "Clear 3 perfect rounds in one game.", group: "Rounds", progress: x => goal(x.run.perfectRounds, 3) },

  // Combos
  { id: "combo_3", name: "On a Roll", desc: "Reach a ×1.5 combo (3 flawless words in a row).", group: "Combos", progress: x => goal(x.run.bestStreak, 3) },
  { id: "combo_10", name: "Hot Streak", desc: "Reach a ×3 combo (10 in a row).", group: "Combos", progress: x => goal(x.run.bestStreak, 10) },
  { id: "combo_15", name: "Max Combo", desc: "Reach the ×4 combo (15 in a row).", group: "Combos", progress: x => goal(x.run.bestStreak, 15) },
  { id: "combo_30", name: "Flawless Machine", desc: "Finish 30 words in a row with no wrong letters.", group: "Combos", progress: x => goal(x.run.bestStreak, 30) },
  { id: "combo_50", name: "Perfectionist", desc: "Finish 50 words in a row with no wrong letters.", group: "Combos", progress: x => goal(x.run.bestStreak, 50) },

  // Bosses
  { id: "boss_untouched", name: "Untouchable", desc: "Beat a boss with no wrong letters or timeouts.", group: "Bosses", progress: x => yes(x.run.flawlessBosses >= 1) },
  { id: "boss_clutch", name: "Clutch", desc: "Beat a boss with only one life left.", group: "Bosses", progress: x => yes(x.run.clutchBosses >= 1) },
  { id: "boss_5", name: "Boss Hunter", desc: "Beat 5 bosses in one game.", group: "Bosses", progress: x => goal(x.run.bossesDefeated, 5) },
  { id: "boss_10", name: "Boss Rush", desc: "Beat 10 bosses in one game.", group: "Bosses", progress: x => goal(x.run.bossesDefeated, 10) },
  { id: "boss_total_50", name: "Boss Collector", desc: "Beat 50 bosses in total.", group: "Bosses", progress: x => goal(x.life.bosses, 50), showProgress: true },

  // Speed
  { id: "fast_1s", name: "Quick Fingers", desc: "Finish a word in under 1 second.", group: "Speed", progress: x => yes(x.run.fastest !== null && x.run.fastest < 1) },
  { id: "fast_half", name: "Blink", desc: "Finish a word in under 0.6 seconds.", group: "Speed", progress: x => yes(x.run.fastest !== null && x.run.fastest < 0.6) },
  { id: "fast_long", name: "Lightning", desc: "Finish a 7-letter word in under 1.5 seconds.", group: "Speed", progress: x => yes(x.run.fastestLong !== null && x.run.fastestLong < 1.5) },
  { id: "sharpshooter", name: "Sharpshooter", desc: "End a game with 98% accuracy or better (at least 100 letters typed).", group: "Speed", progress: x => yes(x.run.over && x.run.keys >= 100 && x.run.goodKeys / x.run.keys >= 0.98) },

  // Power-ups
  { id: "bucket_full", name: "Hoarder", desc: "Fill all 3 power-up slots.", group: "Power-ups", progress: x => yes(x.run.bucketFilled) },
  { id: "shield_save", name: "Saved!", desc: "Have a Shield block a miss.", group: "Power-ups", progress: x => yes(x.run.shieldBlocks >= 1) },
  { id: "gold_rush", name: "Gold Rush", desc: "Use a gold bonus power-up.", group: "Power-ups", progress: x => yes(x.run.bonusesUsed >= 1) },
  { id: "toolbox", name: "Toolbox", desc: "Use 10 power-ups in one game.", group: "Power-ups", progress: x => goal(x.run.powerUpsUsed, 10) },
  { id: "purist", name: "Purist", desc: "Reach round 5 without using a power-up.", group: "Power-ups", progress: x => yes(x.run.round >= 5 && x.run.powerUpsUsed === 0) },

  // Difficulty
  { id: "hard_boss", name: "Hardened", desc: "Beat a boss on Hard.", group: "Difficulty", progress: x => yes(x.run.difficulty === "hard" && x.run.bossesDefeated >= 1) },
  { id: "hard_r5", name: "Iron Fingers", desc: "Reach round 5 on Hard.", group: "Difficulty", progress: x => yes(x.run.difficulty === "hard" && x.run.round >= 5) },
  { id: "impossible_boss", name: "Not So Impossible", desc: "Beat a boss on Impossible.", group: "Difficulty", progress: x => yes(x.run.difficulty === "impossible" && x.run.bossesDefeated >= 1) },
  { id: "impossible_r3", name: "Truly Impossible", desc: "Reach round 3 on Impossible.", group: "Difficulty", progress: x => yes(x.run.difficulty === "impossible" && x.run.round >= 3) },
  { id: "all_difficulties", name: "Well Rounded", desc: "Beat a boss on every difficulty.", group: "Difficulty", progress: x => goal(x.life.bossDifficulties.length, DIFFICULTY_ORDER.length), showProgress: true },

  // Daily Challenge
  { id: "daily_first", name: "Daily Player", desc: "Play a Daily Challenge.", group: "Daily", progress: x => yes(x.run.daily || x.dailyStreak >= 1) },
  { id: "daily_3", name: "Regular", desc: "Play the Daily Challenge 3 days in a row.", group: "Daily", progress: x => goal(x.dailyStreak, 3), showProgress: true },
  { id: "daily_7", name: "Weekly Ritual", desc: "Play the Daily Challenge 7 days in a row.", group: "Daily", progress: x => goal(x.dailyStreak, 7), showProgress: true },
  { id: "daily_30", name: "Devoted", desc: "Play the Daily Challenge 30 days in a row.", group: "Daily", progress: x => goal(x.dailyStreak, 30), showProgress: true },
  { id: "daily_5k", name: "Daily Champion", desc: "Score 5,000 points in a Daily Challenge.", group: "Daily", progress: x => yes(x.run.daily && x.run.score >= 5000) },

  // Career (adds up across games)
  { id: "words_500", name: "Wordsmith", desc: "Type 500 words in total.", group: "Career", progress: x => goal(x.life.words, 500), showProgress: true },
  { id: "words_2500", name: "Typing Machine", desc: "Type 2,500 words in total.", group: "Career", progress: x => goal(x.life.words, 2500), showProgress: true },
  { id: "words_10k", name: "Living Dictionary", desc: "Type 10,000 words in total.", group: "Career", progress: x => goal(x.life.words, 10000), showProgress: true },
  { id: "games_25", name: "Keep Coming Back", desc: "Play 25 games.", group: "Career", progress: x => goal(x.life.games, 25), showProgress: true },
  { id: "games_100", name: "Dedicated", desc: "Play 100 games.", group: "Career", progress: x => goal(x.life.games, 100), showProgress: true },
  { id: "powerups_100", name: "Power User", desc: "Use 100 power-ups in total.", group: "Career", progress: x => goal(x.life.powerUps, 100), showProgress: true },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a])) as Record<string, Achievement>;

/** id -> the date it was unlocked ("2026-11-16"). */
export type Unlocked = Record<string, string>;

/** Achievements newly reached in `x` that aren't in `unlocked` yet. */
export function newlyUnlocked(x: AchievementContext, unlocked: Unlocked): Achievement[] {
  return ACHIEVEMENTS.filter(a => {
    if (unlocked[a.id]) return false;
    const [cur, target] = a.progress(x);
    return cur >= target;
  });
}
