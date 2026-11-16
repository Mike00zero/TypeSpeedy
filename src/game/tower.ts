/**
 * Tower Climb: 100 floors on Medium rules with only 2 lives. Every 10th floor ends with a guardian
 * boss; beating it saves a checkpoint, so a fall sends you back to your last checkpoint, not floor 1.
 * Clearing floor 100 unlocks the Phoenix Feather for Survival games.
 */
import { DIFFICULTIES } from "./config";

export const TOWER = {
  floors: 100,
  checkpointEvery: 10,
  lives: 2,
  maxLives: 3, // Extra Life power-ups can't take you past this
  wordsPerFloor: 3,
  bannerMs: 1100, // floor banners are quicker than Survival's round banners (there are 100 of them)
  finalBossHp: 6,
  finalBossName: "The Summit Warden",
  difficulty: DIFFICULTIES.medium,
};

/** Phoenix Feather (the Tower reward): once per Survival game, losing your last life brings you back. */
export const PHOENIX = { lives: 6 };

/** The Survival round whose clock and word lengths a floor uses: floor 1 plays like round 1, floor 100 like round 15. */
export function towerTier(floor: number): number {
  return 1 + Math.floor((floor - 1) / 7);
}

export function isCheckpointFloor(floor: number): boolean {
  return floor % TOWER.checkpointEvery === 0;
}

/** The checkpoint at or below a floor ("next checkpoint" text uses the one above). */
export function nextCheckpoint(floor: number): number {
  return Math.ceil(floor / TOWER.checkpointEvery) * TOWER.checkpointEvery;
}

export type TowerProgress = {
  checkpoint: number; // last checkpoint floor cleared (0 = start at floor 1)
  best: number; // highest floor reached
  cleared: boolean; // has reached the top at least once (unlocks the Phoenix Feather)
  climbs: number; // attempts started
};

export const EMPTY_TOWER: TowerProgress = { checkpoint: 0, best: 0, cleared: false, climbs: 0 };
