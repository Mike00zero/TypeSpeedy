/**
 * Achievements: one-time goals that unlock during play and stay unlocked.
 * Some are about a single game ("reach round 10"), some add up across every game ("type 500 words").
 */
import { DIFFICULTY_ORDER, type DifficultyId } from "./config";
import { MIX, type GameMode } from "./modes";

/** What happened in the current game so far. */
export type RunStats = {
  mode: GameMode;
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
  fastestWord: string | null; // the word that was fastest
  typingSeconds: number; // time spent on words (not counting banners, pauses or menus)
  fastestMid: number | null; // seconds, a word of 5+ letters
  fastestLong: number | null; // seconds, a 7-letter word
  keys: number;
  goodKeys: number;
  // Tower Climb
  startFloor: number;
  floorCleared: number; // highest floor cleared this climb (0 = none)
  towerTop: boolean; // cleared floor 100 this climb
  wpm: number; // words per minute this game (Sprint and Zen)
  giantBosses: number; // Marathon Mix: Giant Bosses beaten
  twistsSeen: number; // Marathon Mix: different twists played this game
};

/** Totals and records across every finished game (shown on the Stats screen). */
export type LifetimeStats = {
  games: number;
  words: number;
  bosses: number;
  powerUps: number;
  bossDifficulties: DifficultyId[]; // difficulties a boss has been beaten on
  // Added with the Stats screen (older saves start these from zero)
  points: number;
  keys: number;
  goodKeys: number;
  typingSeconds: number;
  bestRound: number;
  bestStreak: number;
  fastest: { t: number; w: string } | null;
  perfectRounds: number;
  flawlessBosses: number;
  dailies: number;
  gamesByDifficulty: Record<DifficultyId, number>;
};

export const EMPTY_LIFETIME: LifetimeStats = {
  games: 0,
  words: 0,
  bosses: 0,
  powerUps: 0,
  bossDifficulties: [],
  points: 0,
  keys: 0,
  goodKeys: 0,
  typingSeconds: 0,
  bestRound: 0,
  bestStreak: 0,
  fastest: null,
  perfectRounds: 0,
  flawlessBosses: 0,
  dailies: 0,
  gamesByDifficulty: { easy: 0, medium: 0, hard: 0, impossible: 0 },
};

export function emptyRun(difficulty: DifficultyId = "medium"): RunStats {
  return {
    mode: "classic",
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
    fastestWord: null,
    typingSeconds: 0,
    fastestMid: null,
    fastestLong: null,
    keys: 0,
    goodKeys: 0,
    startFloor: 1,
    floorCleared: 0,
    towerTop: false,
    wpm: 0,
    giantBosses: 0,
    twistsSeen: 0,
  };
}

/** Lifetime totals with the current game added in (so lifetime goals can unlock mid-game). */
export function addRun(life: LifetimeStats, run: RunStats | null): LifetimeStats {
  if (!run) return life;
  const diffs = new Set(life.bossDifficulties);
  if (run.bossesDefeated > 0) diffs.add(run.difficulty);
  const faster =
    run.fastest !== null && run.fastestWord && (!life.fastest || run.fastest < life.fastest.t)
      ? { t: run.fastest, w: run.fastestWord }
      : life.fastest;
  return {
    games: life.games + 1,
    words: life.words + run.wordsTyped,
    bosses: life.bosses + run.bossesDefeated,
    powerUps: life.powerUps + run.powerUpsUsed,
    bossDifficulties: DIFFICULTY_ORDER.filter(d => diffs.has(d)),
    points: life.points + run.score,
    keys: life.keys + run.keys,
    goodKeys: life.goodKeys + run.goodKeys,
    typingSeconds: life.typingSeconds + run.typingSeconds,
    bestRound:
      run.mode === "classic" || run.mode === "sudden" ? Math.max(life.bestRound, run.round) : life.bestRound, // floors aren't rounds
    bestStreak: Math.max(life.bestStreak, run.bestStreak),
    fastest: faster,
    perfectRounds: life.perfectRounds + run.perfectRounds,
    flawlessBosses: life.flawlessBosses + run.flawlessBosses,
    dailies: life.dailies + (run.daily ? 1 : 0),
    gamesByDifficulty: { ...life.gamesByDifficulty, [run.difficulty]: (life.gamesByDifficulty[run.difficulty] ?? 0) + 1 },
  };
}

export type AchievementContext = {
  run: RunStats; // emptyRun() when not in a game
  life: LifetimeStats; // already includes the current game
  dailyStreak: number;
};

export type AchievementGroup =
  | "Getting started"
  | "Score"
  | "Rounds"
  | "Combos"
  | "Bosses"
  | "Speed"
  | "Power-ups"
  | "Difficulty"
  | "Tower"
  | "Sprint"
  | "Zen"
  | "Boss Rush"
  | "Sudden Death"
  | "Marathon Mix"
  | "Daily"
  | "Career";

export const ACHIEVEMENT_GROUPS: AchievementGroup[] = [
  "Getting started",
  "Score",
  "Rounds",
  "Combos",
  "Bosses",
  "Speed",
  "Power-ups",
  "Difficulty",
  "Tower",
  "Sprint",
  "Zen",
  "Boss Rush",
  "Sudden Death",
  "Marathon Mix",
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
// Being on round N means N-1 rounds were cleared. Survival only: Tower floors aren't rounds.
// Sudden Death is Survival with one life, so it counts as Survival here.
const survival = (r: RunStats) => r.mode === "classic" || r.mode === "sudden";
const reachedRound = (r: RunStats) => (survival(r) ? r.round : 0);
const sprint = (r: RunStats) => (r.mode === "sprint" ? r.wordsTyped : 0); // words finished in this Sprint
const zen = (r: RunStats) => (r.mode === "zen" ? r.wordsTyped : 0);
const rush = (r: RunStats) => (r.mode === "rush" ? r.bossesDefeated : 0);
// "In one game" boss goals are for Survival, where every boss takes a whole round to reach.
const survivalBosses = (r: RunStats) => (survival(r) ? r.bossesDefeated : 0);
const sudden = (r: RunStats) => (r.mode === "sudden" ? r.round : 0); // round reached in Sudden Death
const mix = (r: RunStats) => (r.mode === "mix" ? r.round : 0);
const tower = (r: RunStats, floorsCleared: number) => r.mode === "tower" && r.floorCleared >= floorsCleared;

export const ACHIEVEMENTS: Achievement[] = [
  // Getting started (the only easy ones)
  { id: "first_word", name: "First Words", desc: "Finish your first word.", group: "Getting started", progress: x => yes(x.run.wordsTyped >= 1) },
  { id: "first_boss", name: "Boss Slayer", desc: "Beat your first boss.", group: "Getting started", progress: x => yes(x.run.bossesDefeated >= 1) },
  { id: "first_powerup", name: "Powered Up", desc: "Use a power-up.", group: "Getting started", progress: x => yes(x.run.powerUpsUsed >= 1) },

  // Score in one game
  { id: "score_10k", name: "Five Digits", desc: "Score 10,000 points in one Survival game.", group: "Score", progress: x => goal(survival(x.run) ? x.run.score : 0, 10000) },
  { id: "score_30k", name: "High Scorer", desc: "Score 30,000 points in one Survival game.", group: "Score", progress: x => goal(survival(x.run) ? x.run.score : 0, 30000) },
  { id: "score_75k", name: "Hall of Fame", desc: "Score 75,000 points in one Survival game.", group: "Score", progress: x => goal(survival(x.run) ? x.run.score : 0, 75000) },
  { id: "score_150k", name: "Legend", desc: "Score 150,000 points in one Survival game.", group: "Score", progress: x => goal(survival(x.run) ? x.run.score : 0, 150000) },

  // Rounds
  { id: "round_10", name: "Double Digits", desc: "Reach round 10.", group: "Rounds", progress: x => goal(reachedRound(x.run), 10) },
  { id: "round_20", name: "Top Speed", desc: "Reach round 20.", group: "Rounds", progress: x => goal(reachedRound(x.run), 20) },
  { id: "round_30", name: "Marathon", desc: "Reach round 30.", group: "Rounds", progress: x => goal(reachedRound(x.run), 30) },
  { id: "round_40", name: "Ultramarathon", desc: "Reach round 40.", group: "Rounds", progress: x => goal(reachedRound(x.run), 40) },
  { id: "round_50", name: "Endless", desc: "Reach round 50.", group: "Rounds", progress: x => goal(reachedRound(x.run), 50) },
  { id: "perfect_3", name: "Clean Sweep", desc: "Clear 3 perfect rounds (boss included, no wrong letters or timeouts) in one game.", group: "Rounds", progress: x => goal(survival(x.run) ? x.run.perfectRounds : 0, 3) },
  { id: "perfect_10", name: "Spotless", desc: "Clear 10 perfect rounds in one game.", group: "Rounds", progress: x => goal(survival(x.run) ? x.run.perfectRounds : 0, 10) },

  // Combos (flawless words in a row)
  { id: "combo_25", name: "Hot Streak", desc: "Finish 25 words in a row with no wrong letters.", group: "Combos", progress: x => goal(x.run.bestStreak, 25) },
  { id: "combo_50", name: "Flawless Machine", desc: "Finish 50 words in a row with no wrong letters.", group: "Combos", progress: x => goal(x.run.bestStreak, 50) },
  { id: "combo_100", name: "Hundred Club", desc: "Finish 100 words in a row with no wrong letters.", group: "Combos", progress: x => goal(x.run.bestStreak, 100) },
  { id: "combo_150", name: "Perfectionist", desc: "Finish 150 words in a row with no wrong letters.", group: "Combos", progress: x => goal(x.run.bestStreak, 150) },
  { id: "combo_250", name: "Untouchable Hands", desc: "Finish 250 words in a row with no wrong letters.", group: "Combos", progress: x => goal(x.run.bestStreak, 250) },

  // Bosses
  { id: "boss_clutch", name: "Clutch", desc: "Beat a boss with only one life left.", group: "Bosses", progress: x => yes(x.run.clutchBosses >= 1) },
  { id: "boss_untouched_5", name: "Untouchable", desc: "Beat 5 bosses with no wrong letters or timeouts in one Survival game.", group: "Bosses", progress: x => goal(survival(x.run) ? x.run.flawlessBosses : 0, 5) },
  { id: "boss_20", name: "Boss Hunter", desc: "Beat 20 bosses in one Survival game.", group: "Bosses", progress: x => goal(survivalBosses(x.run), 20) },
  { id: "boss_35", name: "Boss Marathon", desc: "Beat 35 bosses in one Survival game.", group: "Bosses", progress: x => goal(survivalBosses(x.run), 35) },
  { id: "boss_total_250", name: "Boss Collector", desc: "Beat 250 bosses in total.", group: "Bosses", progress: x => goal(x.life.bosses, 250), showProgress: true },

  // Speed and accuracy
  { id: "fast_5_09", name: "Quick Fingers", desc: "Finish a word of 5 or more letters in under 0.9 seconds.", group: "Speed", progress: x => yes(x.run.fastestMid !== null && x.run.fastestMid < 0.9) },
  { id: "fast_7_10", name: "Lightning", desc: "Finish a 7-letter word in under 1 second.", group: "Speed", progress: x => yes(x.run.fastestLong !== null && x.run.fastestLong < 1) },
  { id: "fast_7_07", name: "Blink", desc: "Finish a 7-letter word in under 0.7 seconds.", group: "Speed", progress: x => yes(x.run.fastestLong !== null && x.run.fastestLong < 0.7) },
  { id: "sharpshooter_500", name: "Sharpshooter", desc: "End a game with 99% accuracy or better (at least 500 letters typed).", group: "Speed", progress: x => yes(x.run.over && x.run.keys >= 500 && x.run.goodKeys / x.run.keys >= 0.99) },

  // Power-ups
  { id: "shield_5", name: "Saved!", desc: "Have Shields block 5 misses in one game.", group: "Power-ups", progress: x => goal(x.run.shieldBlocks, 5) },
  { id: "gold_5", name: "Gold Rush", desc: "Use 5 gold bonus power-ups in one game.", group: "Power-ups", progress: x => goal(x.run.bonusesUsed, 5) },
  { id: "toolbox_40", name: "Toolbox", desc: "Use 40 power-ups in one game.", group: "Power-ups", progress: x => goal(x.run.powerUpsUsed, 40) },
  { id: "purist_15", name: "Purist", desc: "Reach round 15 without using a power-up.", group: "Power-ups", progress: x => yes(survival(x.run) && x.run.round >= 15 && x.run.powerUpsUsed === 0) },

  // Difficulty
  { id: "hard_boss_5", name: "Hardened", desc: "Beat 5 bosses in one game on Hard.", group: "Difficulty", progress: x => yes(x.run.difficulty === "hard" && x.run.bossesDefeated >= 5) },
  { id: "hard_r15", name: "Iron Fingers", desc: "Reach round 15 on Hard.", group: "Difficulty", progress: x => yes(x.run.difficulty === "hard" && x.run.round >= 15) },
  { id: "impossible_boss", name: "Not So Impossible", desc: "Beat a boss on Impossible.", group: "Difficulty", progress: x => yes(x.run.difficulty === "impossible" && x.run.bossesDefeated >= 1) },
  { id: "impossible_r8", name: "Truly Impossible", desc: "Reach round 8 on Impossible.", group: "Difficulty", progress: x => yes(x.run.difficulty === "impossible" && x.run.round >= 8) },
  { id: "all_difficulties", name: "Well Rounded", desc: "Beat a boss on every difficulty.", group: "Difficulty", progress: x => goal(x.life.bossDifficulties.length, DIFFICULTY_ORDER.length), showProgress: true },

  // Tower Climb
  { id: "tower_10", name: "Base Camp", desc: "Reach the first Tower checkpoint (clear floor 10).", group: "Tower", progress: x => yes(tower(x.run, 10)) },
  { id: "tower_50", name: "Halfway Up", desc: "Clear floor 50 of the Tower.", group: "Tower", progress: x => yes(tower(x.run, 50)) },
  { id: "tower_80", name: "Thin Air", desc: "Clear floor 80 of the Tower.", group: "Tower", progress: x => yes(tower(x.run, 80)) },
  { id: "tower_top", name: "Summit", desc: "Defeat the Typo Tyrant at the top of the Tower.", group: "Tower", progress: x => yes(x.run.towerTop) },
  { id: "tower_free_solo", name: "Free Solo", desc: "Climb all 100 floors in one go, starting from floor 1.", group: "Tower", progress: x => yes(x.run.towerTop && x.run.startFloor === 1) },

  // Sprint (60 seconds)
  { id: "sprint_20", name: "Off the Blocks", desc: "Finish 20 words in one Sprint.", group: "Sprint", progress: x => goal(sprint(x.run), 20) },
  { id: "sprint_35", name: "Sprinter", desc: "Finish 35 words in one Sprint.", group: "Sprint", progress: x => goal(sprint(x.run), 35) },
  { id: "sprint_50", name: "Photo Finish", desc: "Finish 50 words in one Sprint.", group: "Sprint", progress: x => goal(sprint(x.run), 50) },
  { id: "sprint_clean", name: "Clean Run", desc: "Finish 25 words in a Sprint without a single wrong letter.", group: "Sprint", progress: x => yes(sprint(x.run) >= 25 && x.run.keys === x.run.goodKeys) },

  // Zen (no clock, no lives)
  { id: "zen_100", name: "Zen Master", desc: "Finish 100 words in one Zen session.", group: "Zen", progress: x => goal(zen(x.run), 100) },
  { id: "zen_mindful", name: "Mindful", desc: "Finish 50 words in a Zen session without a single wrong letter.", group: "Zen", progress: x => yes(zen(x.run) >= 50 && x.run.keys === x.run.goodKeys) },
  { id: "zen_flow", name: "In the Flow", desc: "Average 60 words per minute over a Zen session of 50+ words.", group: "Zen", progress: x => yes(x.run.over && zen(x.run) >= 50 && x.run.wpm >= 60) },

  // Boss Rush
  { id: "rush_5", name: "Rush Hour", desc: "Beat 5 bosses in one Boss Rush.", group: "Boss Rush", progress: x => goal(rush(x.run), 5) },
  { id: "rush_15", name: "Gauntlet", desc: "Beat 15 bosses in one Boss Rush.", group: "Boss Rush", progress: x => goal(rush(x.run), 15) },
  { id: "rush_30", name: "Boss Slayer Supreme", desc: "Beat 30 bosses in one Boss Rush.", group: "Boss Rush", progress: x => goal(rush(x.run), 30) },
  { id: "rush_flawless_5", name: "Untouched Rush", desc: "Beat 5 bosses in a Boss Rush without a wrong letter or timeout.", group: "Boss Rush", progress: x => yes(x.run.mode === "rush" && x.run.flawlessBosses >= 5 && x.run.flawlessBosses === x.run.bossesDefeated) },

  // Sudden Death (one life)
  { id: "sudden_r5", name: "Living Dangerously", desc: "Reach round 5 in Sudden Death.", group: "Sudden Death", progress: x => goal(sudden(x.run), 5) },
  { id: "sudden_r10", name: "Nerves of Steel", desc: "Reach round 10 in Sudden Death.", group: "Sudden Death", progress: x => goal(sudden(x.run), 10) },
  { id: "sudden_r20", name: "Untouchable Soul", desc: "Reach round 20 in Sudden Death.", group: "Sudden Death", progress: x => goal(sudden(x.run), 20) },
  { id: "sudden_hard", name: "Edge of the Blade", desc: "Beat a boss on Hard in Sudden Death.", group: "Sudden Death", progress: x => yes(x.run.mode === "sudden" && x.run.difficulty === "hard" && x.run.bossesDefeated >= 1) },

  // Marathon Mix
  { id: "mix_r10", name: "Mixed Bag", desc: "Reach round 10 in Marathon Mix.", group: "Marathon Mix", progress: x => goal(mix(x.run), 10) },
  { id: "mix_r20", name: "Chaos Theory", desc: "Reach round 20 in Marathon Mix.", group: "Marathon Mix", progress: x => goal(mix(x.run), 20) },
  { id: "mix_giant", name: "Giant Killer", desc: "Beat a Giant Boss in Marathon Mix.", group: "Marathon Mix", progress: x => yes(x.run.mode === "mix" && x.run.giantBosses >= 1) },
  { id: "mix_10_twists", name: "Seen It All", desc: `Play ${MIX.seenItAll} different twists in one Marathon Mix.`, group: "Marathon Mix", progress: x => goal(x.run.mode === "mix" ? x.run.twistsSeen : 0, MIX.seenItAll) },

  // Daily Challenge
  { id: "daily_first", name: "Daily Player", desc: "Play a Daily Challenge.", group: "Daily", progress: x => yes(x.run.daily || x.dailyStreak >= 1) },
  { id: "daily_7", name: "Weekly Ritual", desc: "Play the Daily Challenge 7 days in a row.", group: "Daily", progress: x => goal(x.dailyStreak, 7), showProgress: true },
  { id: "daily_30", name: "Devoted", desc: "Play the Daily Challenge 30 days in a row.", group: "Daily", progress: x => goal(x.dailyStreak, 30), showProgress: true },
  { id: "daily_100", name: "Unbroken", desc: "Play the Daily Challenge 100 days in a row.", group: "Daily", progress: x => goal(x.dailyStreak, 100), showProgress: true },
  { id: "daily_30k", name: "Daily Champion", desc: "Score 30,000 points in a Daily Challenge.", group: "Daily", progress: x => yes(x.run.daily && x.run.score >= 30000) },

  // Career (adds up across games)
  { id: "words_5000", name: "Wordsmith", desc: "Type 5,000 words in total.", group: "Career", progress: x => goal(x.life.words, 5000), showProgress: true },
  { id: "words_25k", name: "Typing Machine", desc: "Type 25,000 words in total.", group: "Career", progress: x => goal(x.life.words, 25000), showProgress: true },
  { id: "words_100k", name: "Living Dictionary", desc: "Type 100,000 words in total.", group: "Career", progress: x => goal(x.life.words, 100000), showProgress: true },
  { id: "games_100", name: "Keep Coming Back", desc: "Play 100 games.", group: "Career", progress: x => goal(x.life.games, 100), showProgress: true },
  { id: "games_500", name: "Dedicated", desc: "Play 500 games.", group: "Career", progress: x => goal(x.life.games, 500), showProgress: true },
  { id: "powerups_1000", name: "Power User", desc: "Use 1,000 power-ups in total.", group: "Career", progress: x => goal(x.life.powerUps, 1000), showProgress: true },
];

export const ACHIEVEMENT_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a])) as Record<string, Achievement>;

/** id -> the date it was unlocked ("2026-11-16"). */
export type Unlocked = Record<string, string>;

/** Drops ids that aren't achievements any more (goals get renamed as the game is tuned). */
export function pruneUnlocked(unlocked: Unlocked): Unlocked {
  return Object.fromEntries(Object.entries(unlocked).filter(([id]) => ACHIEVEMENT_BY_ID[id]));
}

/** Achievements newly reached in `x` that aren't in `unlocked` yet. */
export function newlyUnlocked(x: AchievementContext, unlocked: Unlocked): Achievement[] {
  return ACHIEVEMENTS.filter(a => {
    if (unlocked[a.id]) return false;
    const [cur, target] = a.progress(x);
    return cur >= target;
  });
}
