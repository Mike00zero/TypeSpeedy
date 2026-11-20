/** Game modes, shown in the mode list on the main menu. Add new modes here. */
import { DIFFICULTIES } from "./config";

export type GameMode = "classic" | "tower" | "sprint" | "zen" | "rush" | "sudden" | "mix";

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
    id: "sprint",
    name: "Sprint",
    tagline: "60 seconds · as many words as you can",
    detail: "One minute on the clock and no lives. A wrong letter costs a second. No power-ups or bosses: just speed.",
  },
  {
    id: "zen",
    name: "Zen",
    tagline: "No clock · no lives · just type",
    detail: "Practice at your own pace. Nothing can end it: tap Finish when you're done to see your speed and accuracy.",
  },
  {
    id: "mix",
    name: "Marathon Mix",
    tagline: "A new twist every round",
    detail: "Survival on Medium, but every round changes the rules: backwards words, vanishing letters, giant bosses, double-or-nothing and more.",
  },
  {
    id: "tower",
    name: "Tower Climb",
    tagline: "100 floors · 2 lives · checkpoints",
    detail: "Climb 100 floors on Medium rules with 2 lives. Every 10th floor saves a checkpoint. Reach the top for the Phoenix Feather.",
  },
  {
    id: "sudden",
    name: "Sudden Death",
    tagline: "One life · double points",
    detail: "Survival on any difficulty with a single life. One wrong letter or one slow word ends it, but every point counts double.",
  },
  {
    id: "rush",
    name: "Boss Rush",
    tagline: "Nothing but bosses · 5 lives",
    detail: "No normal rounds: one boss after another, each a bit faster. Win a gold bonus after every boss. How many can you beat?",
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

/** Sudden Death: Survival with one life and double points. Extra lives never drop. */
export const SUDDEN = {
  multiplier: 2,
};

/** Marathon Mix: Survival on Medium where every round after the first gets a random twist. */
export const MIX = {
  difficulty: DIFFICULTIES.medium,
  vanishMs: 900, // Vanishing: how long a word stays visible
  cardMs: 5000, // how long the "new twist" card stays up (a tap starts the round sooner)
  noRepeat: 4, // a twist won't come back within this many rounds
  seenItAll: 10, // different twists in one game for the "Seen It All" achievement
};

export type MixTwistId =
  | "warmup"
  | "backwards"
  | "tight"
  | "vanish"
  | "long"
  | "giant"
  | "danger"
  | "golden"
  | "breather"
  | "short"
  | "shrinking"
  | "masked"
  | "scramble"
  | "shields"
  | "surge"
  | "recovery"
  | "unplugged";

export type MixTwist = {
  id: MixTwistId;
  name: string;
  desc: string; // shown on the round banner and under the lives
  timeFactor: number; // × the round's time per word
  pointsFactor: number; // × points for words
  missCost: number; // lives lost per wrong letter or timeout
  bossHpFactor: number; // × the boss's health (and its bonus points)
  lengths?: [number, number]; // word lengths instead of the round's usual ones
  backwards?: boolean; // words are spelled backwards
  vanish?: boolean; // words disappear after MIX.vanishMs
  masked?: boolean; // every other letter is hidden until you type it
  scramble?: boolean; // letters are shuffled; type them as shown
  shrinkPerWord?: number; // each word in the round gets this much less of the clock (0.05 = 5%)
  startShields?: number; // free Shields at the start of the round
  powerUpEvery?: number; // a free power-up every N words (if the bucket has room)
  healOnFlawless?: boolean; // a word with no wrong letters gives back a life
  lockPowerUps?: boolean; // power-ups can't be used this round
};

const plain = { timeFactor: 1, pointsFactor: 1, missCost: 1, bossHpFactor: 1 };

export const MIX_TWISTS: Record<MixTwistId, MixTwist> = {
  warmup: { id: "warmup", name: "Warm-up", desc: "Normal rules. Enjoy it while it lasts.", ...plain },
  backwards: { id: "backwards", name: "Backwards", desc: "Every word is spelled backwards. Type it as you see it.", ...plain, pointsFactor: 1.5, backwards: true },
  tight: { id: "tight", name: "Tight Clock", desc: "30% less time per word, 50% more points.", ...plain, timeFactor: 0.7, pointsFactor: 1.5 },
  vanish: { id: "vanish", name: "Vanishing", desc: "Words disappear after a moment. Remember them!", ...plain, pointsFactor: 1.5, vanish: true },
  long: { id: "long", name: "Long Haul", desc: "Only the longest words. 25% more points.", ...plain, lengths: [6, 7], pointsFactor: 1.25 },
  giant: { id: "giant", name: "Giant Boss", desc: "This round's boss has double health and pays double.", ...plain, bossHpFactor: 2 },
  danger: { id: "danger", name: "Double or Nothing", desc: "Double points, but every miss costs 2 lives.", ...plain, pointsFactor: 2, missCost: 2 },
  golden: { id: "golden", name: "Golden Round", desc: "Every word scores double. No catch.", ...plain, pointsFactor: 2 },
  breather: { id: "breather", name: "Breather", desc: "50% more time per word, half points. Catch your breath.", ...plain, timeFactor: 1.5, pointsFactor: 0.5 },
  short: { id: "short", name: "Short & Sharp", desc: "Only tiny words, but the clock is 40% shorter.", ...plain, lengths: [3, 4], timeFactor: 0.6, pointsFactor: 1.25 },
  shrinking: { id: "shrinking", name: "Shrinking Clock", desc: "Every word gets a little less time than the last.", ...plain, shrinkPerWord: 0.06, pointsFactor: 1.5 },
  masked: { id: "masked", name: "Masked", desc: "Every other letter is hidden until you type it. Guess the word!", ...plain, masked: true, pointsFactor: 1.5 },
  scramble: { id: "scramble", name: "Scrambled", desc: "The letters are jumbled. Type them exactly as shown.", ...plain, scramble: true, pointsFactor: 1.5 },
  shields: { id: "shields", name: "Shields Up", desc: "Start the round with 2 free Shields.", ...plain, startShields: 2 },
  surge: { id: "surge", name: "Power Surge", desc: "A free power-up every 3 words (if your bucket has room).", ...plain, powerUpEvery: 3 },
  recovery: { id: "recovery", name: "Recovery", desc: "Every word with no wrong letters gives back a life.", ...plain, healOnFlawless: true },
  unplugged: { id: "unplugged", name: "Unplugged", desc: "Power-ups are locked this round. 50% more points.", ...plain, lockPowerUps: true, pointsFactor: 1.5 },
};

/** A random twist for the next round, avoiding the last few. */
export function pickTwist(recent: MixTwistId[], random: () => number = Math.random): MixTwistId {
  const avoid = new Set(recent.slice(-MIX.noRepeat));
  const pool = (Object.keys(MIX_TWISTS) as MixTwistId[]).filter(id => id !== "warmup" && !avoid.has(id));
  return pool[Math.floor(random() * pool.length)];
}

export type MixBest = { score: number; round: number };
export const EMPTY_MIX: MixBest = { score: 0, round: 0 };

/** Boss Rush: back-to-back bosses on Medium rules. Boss N uses round N's clock and word lengths. */
export const RUSH = {
  lives: 5,
  maxLives: 7, // Extra Life power-ups can't take you past this
  introMs: 1500, // shorter boss intro than Survival (there's one every few words)
  breatherMs: 2200, // after a win, before the next boss (lets the fanfare play)
  difficulty: DIFFICULTIES.medium,
};

export type RushBest = { bosses: number; score: number };
export const EMPTY_RUSH: RushBest = { bosses: 0, score: 0 };

/** Zen: no clock, no lives, no score. Just words, speed and accuracy. */
export const ZEN = {
  lengths: [3, 7] as [number, number],
  difficulty: DIFFICULTIES.medium, // only used for labels and stats
  minWordsForBest: 20, // a session needs this many words before its speed counts as a best
};

export type ZenBest = { words: number; wpm: number; sessions: number };
export const EMPTY_ZEN: ZenBest = { words: 0, wpm: 0, sessions: 0 };

export type SprintBest = { score: number; words: number; wpm: number };
export const EMPTY_SPRINT: SprintBest = { score: 0, words: 0, wpm: 0 };

/** Words per minute the standard way: 5 letters = 1 word. */
export function wpm(letters: number, seconds: number): number {
  return seconds > 0 ? Math.round(letters / 5 / (seconds / 60)) : 0;
}
