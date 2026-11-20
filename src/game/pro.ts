/**
 * Typo Tyrant Pro: a one-time unlock. What's free and what needs Pro lives here.
 * Free: Survival, Sprint, Zen, the Daily Challenge, achievements and stats, the Classic theme and words.
 * Pro: Tower Climb, Marathon Mix, Boss Rush, Sudden Death, and every other theme and word pack
 * (themes and packs still unlock through achievements, but need Pro to use).
 */
import type { GameMode } from "./modes";

export const PRO = {
  /** Shown until the store gives us the real, localized price. */
  fallbackPrice: "$3.99",
  /** Free players get this many tries of each Pro mode per day. */
  dailyTries: 1,
  modes: ["tower", "mix", "rush", "sudden"] as GameMode[],
  perks: [
    "Tower Climb, Marathon Mix, Boss Rush and Sudden Death",
    "Every color theme and word pack you unlock",
    "One payment, yours forever: no subscription, no ads",
    "Supports a solo developer",
  ],
};

export function isProMode(mode: GameMode): boolean {
  return PRO.modes.includes(mode);
}

/** Which Pro modes have used today's free try. */
export type ProTrials = { date: string; used: GameMode[] };
export const EMPTY_TRIALS: ProTrials = { date: "", used: [] };

export function trialsLeft(trials: ProTrials, mode: GameMode, today: string): number {
  if (!isProMode(mode)) return Infinity;
  const used = trials.date === today ? trials.used.filter(m => m === mode).length : 0;
  return Math.max(0, PRO.dailyTries - used);
}

export function spendTrial(trials: ProTrials, mode: GameMode, today: string): ProTrials {
  const used = trials.date === today ? trials.used : [];
  return { date: today, used: [...used, mode] };
}
