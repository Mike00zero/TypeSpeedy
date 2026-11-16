/** Power-ups the player earns by scoring and uses whenever they like. */

export type PowerUpId = "life" | "refill" | "skip" | "slow" | "shield" | "freeze" | "double";

export type PowerUp = {
  id: PowerUpId;
  name: string; // shown on the slot
  effect: string; // one-line description, shown under the name
  weight: number; // how often it's rolled, relative to the others
};

/** Tuning for rewards and power-up strength. */
export const REWARDS = {
  bucketSize: 3, // power-ups held at once; rewards earned while full are lost
  firstAt: 200, // points for the first reward
  firstGap: 300, // points from the first reward to the second...
  gapGrowth: 100, // ...and each gap after that is this much longer
  slowWords: 3, // Slow Motion: this many words (including the current one)...
  slowFactor: 1.5, // ...get this much more time
  doubleWords: 5, // Double Points: the next this many finished words score double
  freezeSeconds: 3, // Freeze: the clock stops for this long
};

export const POWERUPS: Record<PowerUpId, PowerUp> = {
  life: { id: "life", name: "Extra Life", effect: "+1 life", weight: 12 },
  refill: { id: "refill", name: "Refill", effect: "Full clock on this word", weight: 18 },
  skip: { id: "skip", name: "Skip", effect: "Skip this word, no penalty", weight: 18 },
  slow: { id: "slow", name: "Slow-Mo", effect: `+50% time for ${REWARDS.slowWords} words`, weight: 14 },
  shield: { id: "shield", name: "Shield", effect: "Blocks your next miss", weight: 14 },
  freeze: { id: "freeze", name: "Freeze", effect: `Clock stops ${REWARDS.freezeSeconds}s`, weight: 12 },
  double: { id: "double", name: "Double", effect: `2× points, ${REWARDS.doubleWords} words`, weight: 12 },
};

const ALL = Object.values(POWERUPS);

/** Points needed for the reward after `earned` rewards have been handed out (200, 500, 900, 1400, ...). */
export function rewardThreshold(earned: number): number {
  let at = REWARDS.firstAt;
  for (let k = 0; k < earned; k++) at += REWARDS.firstGap + k * REWARDS.gapGrowth;
  return at;
}

/** A random power-up, weighted. */
export function rollPowerUp(random = Math.random): PowerUpId {
  const total = ALL.reduce((sum, p) => sum + p.weight, 0);
  let r = random() * total;
  for (const p of ALL) {
    r -= p.weight;
    if (r < 0) return p.id;
  }
  return ALL[ALL.length - 1].id;
}

/* ---------- Bonus power-ups: won by beating a boss, held in the single gold slot ---------- */

export type BonusId = "megaLife" | "timeWarp" | "fortress" | "jackpot" | "deepFreeze" | "autoType";

export type BonusPowerUp = { id: BonusId; name: string; effect: string; weight: number };

export const BONUS = {
  megaLives: 3, // Mega Life: lives added
  warpWords: 10, // Time Warp: words with Slow-Mo time (including the current one)
  fortressShields: 3, // Fortress: misses blocked
  jackpotWords: 5, // Jackpot: words that score triple
  deepFreezeSeconds: 8, // Deep Freeze: seconds the clock stops
};

export const BONUS_POWERUPS: Record<BonusId, BonusPowerUp> = {
  megaLife: { id: "megaLife", name: "Mega Life", effect: `+${BONUS.megaLives} lives`, weight: 1 },
  timeWarp: { id: "timeWarp", name: "Time Warp", effect: `+50% time for ${BONUS.warpWords} words`, weight: 1 },
  fortress: { id: "fortress", name: "Fortress", effect: `Blocks your next ${BONUS.fortressShields} misses`, weight: 1 },
  jackpot: { id: "jackpot", name: "Jackpot", effect: `3× points for ${BONUS.jackpotWords} words`, weight: 1 },
  deepFreeze: { id: "deepFreeze", name: "Deep Freeze", effect: `Clock stops ${BONUS.deepFreezeSeconds}s`, weight: 1 },
  autoType: { id: "autoType", name: "Auto-Type", effect: "Finishes the current word for you", weight: 1 },
};

const ALL_BONUS = Object.values(BONUS_POWERUPS);

/** A random bonus power-up, weighted; never the same as `exclude` when there's a choice. */
export function rollBonus(exclude?: BonusId | null, random = Math.random): BonusId {
  const pool = ALL_BONUS.filter(b => b.id !== exclude);
  const total = pool.reduce((sum, b) => sum + b.weight, 0);
  let r = random() * total;
  for (const b of pool) {
    r -= b.weight;
    if (r < 0) return b.id;
  }
  return pool[pool.length - 1].id;
}
