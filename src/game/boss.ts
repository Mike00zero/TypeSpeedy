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

/** All original names. Keep each under about 22 characters so it fits the boss bar. */
export const BOSS_NAMES = [
  // Keys
  "Lord Backspace",
  "Captain Capslock",
  "Count Keystroke",
  "Queen Qwerty",
  "Emperor Escape",
  "The Tab Titan",
  "The Shift Lord",
  "The Ctrl Freak",
  "The Alt Overlord",
  "The Function Fiend",
  "The Insert Imp",
  "The Page Down Pirate",
  "The Spacebar Sentinel",
  "The Return Wyrm",
  "Numlock Necromancer",
  "The Scroll Lock Shade",
  "The Sticky Key",
  "The Ghost Key",
  "The Dead Key",
  "King Keycap",
  "The Dvorak Dread",
  "The Home Row Horror",
  // Typing and typos
  "The Typo Tyrant",
  "The Misspeller",
  "Madame Mistype",
  "Sir Typo-a-Lot",
  "The Fat Finger",
  "The Keymash Monster",
  "Asdf the Unspeakable",
  "Mister Misclick",
  "The Overtyper",
  "The Speed Demon",
  "The Clackening",
  "The Mechanical Menace",
  "The Rubber Dome Brute",
  "The Cursed Cursor",
  // Spelling, words and editing
  "The Spellbreaker",
  "Sir Spellcheck",
  "The Autocorrector",
  "Baron Von Delete",
  "The Red Squiggle",
  "The Red Pen",
  "Proofreader Prime",
  "The Grammar Goblin",
  "The Word Wraith",
  "The Lexicon Lich",
  "The Thesaurus Rex",
  "The Dictionary Dragon",
  "The Vowel Vampire",
  "The Consonant Crusher",
  "The Syllable Snatcher",
  "The Letter Leech",
  "Wordsmith of Woe",
  "The Final Draft",
  "Lord Lorem Ipsum",
  "The Redacted",
  // Punctuation and type
  "Professor Punctuation",
  "Countess Comma",
  "The Semicolon Serpent",
  "The Hyphen Hydra",
  "The Ampersand Fiend",
  "The Asterisk Assassin",
  "The Tilde Terror",
  "The Underscore Reaper",
  "The Hashtag Hex",
  "The Pilcrow Prince",
  "The Bracket Brute",
  "General Glyph",
  "The Font Phantom",
  "The Serif Sorcerer",
  "The Sans-Serif Specter",
  "The Kerning Kraken",
  "The Ligature Lurker",
  "Baroness Bold",
  "The Italic Infiltrator",
  "The Underline Ogre",
];

/**
 * A random boss name that isn't one of the `recent` ones (the bosses already met this game,
 * most recent last). Once most names have been used, only the newest ones are avoided.
 */
export function pickBossName(recent: string[] = [], random: () => number = Math.random): string {
  const avoid = new Set(recent.slice(-Math.floor(BOSS_NAMES.length * 0.75)));
  const pool = BOSS_NAMES.filter(n => !avoid.has(n));
  return pool[Math.floor(random() * pool.length)];
}
