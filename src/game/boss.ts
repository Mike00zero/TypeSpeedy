/** Boss fights: every round ends with one. Tune them here. */
import { MAX_WORD_LENGTH } from "./config";

export const BOSS = {
  bonusPointsPerRound: 50, // beating a boss scores this × the round number
  introMs: 2200, // how long the "BOSS FIGHT" intro shows
};

/** How many words (hits) it takes to beat the boss at the end of a round. */
export function bossHp(round: number): number {
  if (round >= 10) return 5;
  if (round >= 5) return 4;
  return 3;
}

/** Boss words: the longest end of the round's normal range, never over MAX_WORD_LENGTH. */
export function bossRange([min, max]: [number, number]): [number, number] {
  const top = Math.min(max, MAX_WORD_LENGTH);
  return [Math.max(min, top - 1), top];
}

const NAMES = [
  "Lord Backspace",
  "The Typo Tyrant",
  "Count Keystroke",
  "The Spellbreaker",
  "Captain Capslock",
  "Baron Von Delete",
  "The Autocorrector",
  "Queen Qwerty",
  "The Misspeller",
  "Sir Spellcheck",
];

export function pickBossName(previous?: string): string {
  const pool = NAMES.filter(n => n !== previous);
  return pool[Math.floor(Math.random() * pool.length)];
}
