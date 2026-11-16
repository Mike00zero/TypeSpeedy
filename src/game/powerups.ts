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
