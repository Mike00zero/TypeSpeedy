/**
 * Asking for an App Store / Google Play rating, but only at good moments (a new best, the Tower
 * summit), only after a few games, and rarely. The stores also cap how often the prompt appears.
 */
import * as StoreReview from "expo-store-review";

export const REVIEW = {
  minGames: 5, // don't ask brand-new players
  gapDays: 60, // at most once every this many days
  maxAsks: 3,
};

export type ReviewState = { asks: number; last: number }; // last = time of the last ask (ms)
export const EMPTY_REVIEW: ReviewState = { asks: 0, last: 0 };

export function shouldAskForReview(state: ReviewState, gamesPlayed: number, now = Date.now()): boolean {
  if (gamesPlayed < REVIEW.minGames || state.asks >= REVIEW.maxAsks) return false;
  return now - state.last >= REVIEW.gapDays * 24 * 60 * 60 * 1000;
}

/** Shows the native rating prompt if this device supports it. Returns whether it was requested. */
export async function askForReview(): Promise<boolean> {
  try {
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return false;
    await StoreReview.requestReview();
    return true;
  } catch {
    return false;
  }
}
