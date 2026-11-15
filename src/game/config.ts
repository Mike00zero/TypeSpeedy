/** Tuning knobs. Change these to rebalance the game. */
export const CONFIG = {
  lives: 10, // total lives
  timeoutCost: 1, // lives lost when the clock runs out on a word
  wordsPerRound: 10, // words in a normal round
  longRoundsFrom: 8, // from this round on, rounds get longer...
  extraWordsPerLongRound: 2, // ...by this many words per round...
  maxWordsPerRound: 20, // ...up to this many
  startTime: 7.0, // seconds per word in round 1
  timeStep: 0.35, // seconds removed each round
  minTime: 2.5, // floor for the per-word clock
  basePoints: 10, // per word, multiplied by the round number
  flawlessBonus: 0.5, // +50% if no wrong letters in the word
  speedBonus: 1.0, // up to +100% for finishing with the full clock left
};

export function wordsInRound(round: number): number {
  if (round < CONFIG.longRoundsFrom) return CONFIG.wordsPerRound;
  return Math.min(
    CONFIG.maxWordsPerRound,
    CONFIG.wordsPerRound + (round - CONFIG.longRoundsFrom + 1) * CONFIG.extraWordsPerLongRound,
  );
}

export function timeForRound(round: number): number {
  return Math.max(CONFIG.minTime, CONFIG.startTime - (round - 1) * CONFIG.timeStep);
}

/** Word length range (inclusive) for a round. */
export function lengthRange(round: number): [number, number] {
  if (round <= 2) return [3, 5];
  if (round <= 4) return [4, 6];
  if (round <= 7) return [4, 8];
  if (round <= 10) return [5, 9];
  return [6, 12];
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
