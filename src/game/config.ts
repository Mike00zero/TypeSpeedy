/** Rules shared by every difficulty. */
export const CONFIG = {
  timeoutCost: 1, // lives lost when the clock runs out on a word
  wordsPerRound: 10, // words in a normal round
  longRoundsFrom: 8, // from this round on, rounds get longer...
  extraWordsPerLongRound: 2, // ...by this many words per round...
  maxWordsPerRound: 20, // ...up to this many
  basePoints: 10, // per word, multiplied by the round number
  flawlessBonus: 0.5, // +50% if no wrong letters in the word
  speedBonus: 1.0, // up to +100% for finishing with the full clock left
};

export type DifficultyId = "easy" | "medium" | "hard" | "impossible";

export type Difficulty = {
  id: DifficultyId;
  label: string;
  lives: number; // 1 means a single miss or timeout ends the game
  startTime: number; // seconds per word in round 1
  timeStep: number; // seconds removed each round
  minTime: number; // floor for the per-word clock
  /** Word length range (inclusive) for a round. */
  lengths: (round: number) => [number, number];
  words: string; // short description of the word sizes, for the picker
};

/** No word is ever longer than this, on any difficulty (longer ones don't fit the screen well). */
export const MAX_WORD_LENGTH = 7;

/**
 * Word sizes within the 7-letter cap: short 3–4 letters, medium 5–6, long 7.
 * Tune each difficulty here.
 */
export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: "easy",
    label: "Easy",
    lives: 10,
    startTime: 7.0,
    timeStep: 0.15,
    minTime: 2.8,
    lengths: r => (r <= 3 ? [3, 4] : [3, 5]),
    words: "Short words, 3–5 letters",
  },
  medium: {
    id: "medium",
    label: "Medium",
    lives: 10,
    startTime: 7.0,
    timeStep: 0.35,
    minTime: 2.5,
    lengths: r => {
      if (r <= 2) return [3, 4];
      if (r <= 4) return [3, 5];
      if (r <= 7) return [4, 6];
      return [4, 7];
    },
    words: "3–7 letters, longer as you go",
  },
  hard: {
    id: "hard",
    label: "Hard",
    lives: 5,
    startTime: 3.0,
    timeStep: 0.1,
    minTime: 1.5,
    lengths: () => [5, 7],
    words: "Medium to long, 5–7 letters",
  },
  impossible: {
    id: "impossible",
    label: "Impossible",
    lives: 1,
    startTime: 2.0,
    timeStep: 0.05,
    minTime: 1.5,
    lengths: () => [6, 7],
    words: "Longest words, 6–7 letters",
  },
};

export const DIFFICULTY_ORDER: DifficultyId[] = ["easy", "medium", "hard", "impossible"];

export function wordsInRound(round: number): number {
  if (round < CONFIG.longRoundsFrom) return CONFIG.wordsPerRound;
  return Math.min(
    CONFIG.maxWordsPerRound,
    CONFIG.wordsPerRound + (round - CONFIG.longRoundsFrom + 1) * CONFIG.extraWordsPerLongRound,
  );
}

export function timeForRound(round: number, d: Difficulty): number {
  return Math.max(d.minTime, round2(d.startTime - (round - 1) * d.timeStep));
}

export function scoreWord(round: number, secondsUsed: number, limit: number, misses: number): number {
  const left = Math.max(0, 1 - secondsUsed / limit);
  let pts = CONFIG.basePoints * round;
  pts *= 1 + left * CONFIG.speedBonus;
  if (misses === 0) pts *= 1 + CONFIG.flawlessBonus;
  return Math.round(pts);
}

/** "6.65s" / "7s" without trailing zeros. */
export function formatSeconds(s: number): string {
  return `${parseFloat(s.toFixed(2))}s`;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
