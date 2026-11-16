/** Game modes, shown in the mode list on the main menu. Add new modes here. */
import { DIFFICULTIES } from "./config";

export type GameMode = "classic" | "tower" | "sprint";

export type ModeInfo = {
  id: GameMode;
  name: string;
  tagline: string; // one line under the name
  detail: string; // a sentence for the mode list
};

export const MODES: ModeInfo[] = [
  {
    id: "classic",
    name: "Survival",
    tagline: "Last as long as you can",
    detail: "The classic. Rounds get faster, a boss ends every round, and you pick the difficulty.",
  },
  {
    id: "tower",
    name: "Tower Climb",
    tagline: "100 floors · 2 lives · checkpoints",
    detail: "Climb 100 floors on Medium rules with 2 lives. Every 10th floor saves a checkpoint. Reach the top for the Phoenix Feather.",
  },
  {
    id: "sprint",
    name: "Sprint",
    tagline: "60 seconds · as many words as you can",
    detail: "One minute on the clock and no lives. A wrong letter costs a second. No power-ups or bosses: just speed.",
  },
];

export const MODE_BY_ID = Object.fromEntries(MODES.map(m => [m.id, m])) as Record<GameMode, ModeInfo>;

/** Sprint: one 60-second clock for the whole game. */
export const SPRINT = {
  seconds: 60,
  missPenalty: 1, // seconds taken off the clock per wrong letter
  wordPar: 3, // a word finished faster than this earns a speed bonus
  pointsTier: 2, // scores like a round-2 word (before speed, flawless and combo bonuses)
  lengths: [3, 7] as [number, number],
  difficulty: DIFFICULTIES.medium, // only used for labels and stats
};

export type SprintBest = { score: number; words: number; wpm: number };
export const EMPTY_SPRINT: SprintBest = { score: 0, words: 0, wpm: 0 };

/** Words per minute the standard way: 5 letters = 1 word. */
export function wpm(letters: number, seconds: number): number {
  return seconds > 0 ? Math.round(letters / 5 / (seconds / 60)) : 0;
}
