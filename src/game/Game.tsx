"use no memo";
// Game state lives in a mutable ref (G) and the screen re-renders via bump(),
// so this file opts out of the React Compiler's automatic memoization.

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputInstance,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";

import {
  CONFIG,
  COMBO_TIERS,
  comboMultiplier,
  nextComboTier,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  formatSeconds,
  scoreWord,
  timeForRound,
  wordsInRound,
  type Difficulty,
  type DifficultyId,
} from "./config";
import { pickWord } from "./words";
import { bossPalette, fonts, usePalette, type Palette } from "./theme";
import { initSounds, pauseMusic, play, playMusic, playVictory, resumeMusic, setMusicEnabled, setMuted } from "./sound";
import { loadPrefs, saveBest, saveDifficulty, saveMusic, saveMuted, type BestScores } from "./storage";
import { useKeyboardHeight } from "./useKeyboardHeight";
import {
  BONUS,
  BONUS_POWERUPS,
  POWERUPS,
  REWARDS,
  rewardThreshold,
  rollBonus,
  rollPowerUp,
  type BonusId,
  type PowerUpId,
} from "./powerups";
import { BOSS, bossHp, bossRange, pickBossName } from "./boss";

type Phase = "title" | "banner" | "playing" | "between" | "paused" | "over" | "bossReward";
type WordLook = "normal" | "solved" | "timedOut" | "skipped";
type Float = { id: number; text: string; kind: "good" | "bad" | "reward"; x: number; anim: Animated.Value };

type GameState = {
  d: Difficulty;
  phase: Phase;
  score: number;
  lives: number;
  round: number;
  wordInRound: number;
  word: string;
  pos: number;
  wordMisses: number;
  missed: Set<number>;
  wrongAt: number | null;
  look: WordLook;
  wordId: number;
  wordStart: number;
  limit: number; // the round's time per word
  wordLimit: number; // this word's clock: the round's, or longer under Slow-Mo
  pausedRemaining: number; // fraction of the clock left when paused or frozen
  frozen: boolean; // Freeze power-up is holding the clock
  inventory: PowerUpId[]; // the power-up bucket, oldest first
  rewardsEarned: number;
  nextRewardAt: number; // score that earns the next power-up
  shields: number; // misses/timeouts that will be blocked
  slowWords: number; // upcoming words that get Slow-Mo time
  doubleWords: number; // upcoming finished words that score double
  tripleWords: number; // upcoming finished words that score triple (Jackpot)
  powerUpsUsed: number;
  inBoss: boolean; // the end-of-round boss fight (including its intro)
  bossHp: number; // words left to beat the boss
  bossMaxHp: number;
  bossName: string;
  bossesDefeated: number;
  streak: number; // words in a row with no wrong letters
  bestStreak: number;
  bonus: BonusId | null; // the single gold bonus slot
  pendingBonus: BonusId | null; // a newly won bonus waiting on keep-or-swap
  keys: number;
  goodKeys: number;
  wordsTyped: number;
  fastest: { t: number; w: string } | null;
  recent: string[];
};

const MAX_LIVES = Math.max(...DIFFICULTY_ORDER.map(id => DIFFICULTIES[id].lives));

function freshState(d: Difficulty): GameState {
  return {
    d,
    phase: "title",
    score: 0,
    lives: d.lives,
    round: 1,
    wordInRound: 0,
    word: "survival",
    pos: 0,
    wordMisses: 0,
    missed: new Set(),
    wrongAt: null,
    look: "normal",
    wordId: 0,
    wordStart: 0,
    limit: timeForRound(1, d),
    wordLimit: timeForRound(1, d),
    pausedRemaining: 1,
    frozen: false,
    inventory: [],
    rewardsEarned: 0,
    nextRewardAt: rewardThreshold(0),
    shields: 0,
    slowWords: 0,
    doubleWords: 0,
    tripleWords: 0,
    powerUpsUsed: 0,
    inBoss: false,
    bossHp: 0,
    bossMaxHp: 0,
    bossName: "",
    bossesDefeated: 0,
    streak: 0,
    bestStreak: 0,
    bonus: null,
    pendingBonus: null,
    keys: 0,
    goodKeys: 0,
    wordsTyped: 0,
    fastest: null,
    recent: [],
  };
}

export default function Game() {
  const { c: baseColors, isDark } = usePalette();
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const { width } = useWindowDimensions();
  // Width of the play area, measured on layout; the screen width minus the side padding until then.
  const [stageWidth, setStageWidth] = useState(width - 36);
  // How wide one letter of the word font is (per px of font size) on this device, measured once
  // from an off-screen sample. Starts from the font's published width until the sample is in.
  const [glyphPerPx, setGlyphPerPx] = useState(MONO_ADVANCE);
  // Read by nextWord(), which can run from a timer set during an earlier render.
  const sizing = useRef({ stageWidth, glyphPerPx });
  sizing.current = { stageWidth, glyphPerPx };

  const G = useRef<GameState>(freshState(DIFFICULTIES.medium)).current;
  // Boss fights switch the whole screen to the dark boss look.
  const c = G.inBoss ? bossPalette : baseColors;
  const s = styles(c);
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion(v => v + 1), []);
  const [best, setBest] = useState<BestScores>({ easy: 0, medium: 0, hard: 0, impossible: 0 });
  const bestRef = useRef<BestScores>(best);
  const [difficulty, setDifficulty] = useState<DifficultyId>("medium");
  const difficultyRef = useRef<DifficultyId>("medium");
  const [muted, setMutedState] = useState(false);
  const [musicOn, setMusicOnState] = useState(true);
  const [floats, setFloats] = useState<Float[]>([]);
  const [isNewBest, setIsNewBest] = useState(false);
  const [confirmQuit, setConfirmQuit] = useState(false); // pause screen: "are you sure?" step
  const [showHelp, setShowHelp] = useState(false); // start screen: the "How to play" pop-up

  const inputRef = useRef<TextInputInstance>(null);
  const lastText = useRef("");
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const floatId = useRef(0);

  // Animated values
  const fuse = useRef(new Animated.Value(1)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  const letterPop = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const overlayPop = useRef(new Animated.Value(1)).current;
  const comboPop = useRef(new Animated.Value(1)).current;
  const pips = useRef(Array.from({ length: MAX_LIVES }, () => new Animated.Value(1))).current;

  /* ---------- setup ---------- */
  useEffect(() => {
    initSounds();
    loadPrefs().then(p => {
      bestRef.current = p.best;
      setBest(p.best);
      setMutedState(p.muted);
      setMuted(p.muted);
      setMusicOnState(p.music);
      setMusicEnabled(p.music);
      if (G.phase === "title") chooseDifficulty(p.difficulty, false);
    });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    );
    loop.start();
    const sub = AppState.addEventListener("change", st => {
      if (st !== "active") {
        pause();
        pauseMusic(); // also between words or during an intro
      } else if (G.phase !== "paused") resumeMusic();
    });
    return () => {
      loop.stop();
      sub.remove();
      timers.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const later = (fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const focusInput = () => inputRef.current?.focus();
  const resetInput = () => {
    inputRef.current?.clear();
    lastText.current = "";
  };
  const popOverlay = () => {
    overlayPop.setValue(0.85);
    Animated.spring(overlayPop, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }).start();
  };

  /* ---------- effects ---------- */
  // Words are drawn as large as fits, but never below MIN_READABLE_FONT; words that would need
  // to go smaller are never picked (see maxLettersAt).
  const currentFontSize = () => wordFontSize(G.word.length || 8, stageWidth, glyphPerPx);
  const charWidth = () => currentFontSize() * glyphPerPx + LETTER_PAD;

  const addFloat = (text: string, kind: Float["kind"], letterIndex?: number) => {
    const id = ++floatId.current;
    const x = letterIndex === undefined ? 0 : (letterIndex - (G.word.length - 1) / 2) * charWidth();
    const anim = new Animated.Value(0);
    setFloats(f => [...f, { id, text, kind, x, anim }]);
    Animated.timing(anim, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      () => setFloats(f => f.filter(fl => fl.id !== id)),
    );
  };

  const hitEffects = () => {
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: true }).start();
    shake.setValue(0);
    Animated.sequence(
      [-10, 10, -10, 10, -5, 5, 0].map(v => Animated.timing(shake, { toValue: v, duration: 45, useNativeDriver: true })),
    ).start();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  };

  const loseLife = (n: number) => {
    const before = G.lives;
    G.lives = Math.max(0, G.lives - n);
    for (let i = G.lives; i < before; i++) {
      pips[i].setValue(1.8);
      Animated.spring(pips[i], { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
    hitEffects();
  };

  /* ---------- clock ---------- */
  const runClock = (fromFraction: number) => {
    const id = G.wordId;
    fuse.setValue(fromFraction);
    Animated.timing(fuse, {
      toValue: 0,
      duration: fromFraction * G.wordLimit * 1000,
      easing: Easing.linear,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && G.wordId === id && G.phase === "playing") timedOut();
    });
  };

  /* ---------- flow ---------- */
  const chooseDifficulty = (id: DifficultyId, persist = true) => {
    difficultyRef.current = id;
    setDifficulty(id);
    if (persist) {
      saveDifficulty(id);
      Haptics.selectionAsync().catch(() => {});
    }
    // Keep the title screen's HUD in step with the pick.
    if (G.phase === "title") {
      Object.assign(G, freshState(DIFFICULTIES[id]));
      bump();
    }
  };

  const toTitle = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    fuse.stopAnimation();
    fuse.setValue(1);
    Object.assign(G, freshState(DIFFICULTIES[difficultyRef.current]));
    pips.forEach(p => p.setValue(1));
    setFloats([]);
    playMusic(null);
    popOverlay();
    bump();
  };

  const startGame = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    Object.assign(G, freshState(DIFFICULTIES[difficultyRef.current]));
    pips.forEach(p => p.setValue(1));
    setFloats([]);
    setIsNewBest(false);
    focusInput();
    playMusic("main");
    startRound();
  };

  const startRound = () => {
    G.phase = "banner";
    G.limit = timeForRound(G.round, G.d);
    G.wordInRound = 0;
    G.word = "";
    fuse.stopAnimation();
    fuse.setValue(1);
    popOverlay();
    if (G.round > 1) play("round");
    playMusic("main"); // keeps going if it's already on; restarts after a boss
    bump();
    later(nextWord, 1700);
  };

  const nextWord = () => {
    const range = G.d.lengths(G.round);
    G.word = pickWord(
      G.inBoss ? bossRange(range) : range,
      G.recent,
      maxLettersAt(sizing.current.stageWidth, sizing.current.glyphPerPx),
    );
    G.recent.push(G.word);
    if (G.recent.length > 40) G.recent.shift();
    G.pos = 0;
    G.wordMisses = 0;
    G.missed = new Set();
    G.wrongAt = null;
    G.look = "normal";
    G.wordId++;
    G.wordStart = Date.now();
    G.frozen = false;
    if (G.slowWords > 0) {
      G.wordLimit = G.limit * REWARDS.slowFactor;
      G.slowWords--;
    } else G.wordLimit = G.limit;
    G.phase = "playing";
    resetInput();
    runClock(1);
    bump();
  };

  const advance = () => {
    if (G.lives <= 0) return gameOver();
    if (G.inBoss) {
      if (G.bossHp <= 0) bossDefeated();
      else nextWord(); // a timeout or Skip doesn't hurt the boss: just a new word
      return;
    }
    G.wordInRound++;
    if (G.wordInRound >= wordsInRound(G.round)) startBoss();
    else nextWord();
  };

  /* ---------- boss fights ---------- */
  const startBoss = () => {
    G.inBoss = true;
    G.bossMaxHp = bossHp(G.round);
    G.bossHp = G.bossMaxHp;
    G.bossName = pickBossName(G.bossName);
    G.phase = "banner";
    G.word = "";
    fuse.stopAnimation();
    fuse.setValue(1);
    popOverlay();
    play("timeout");
    playMusic("boss");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    bump();
    later(nextWord, BOSS.introMs);
  };

  const nextRound = () => {
    G.round++;
    startRound();
  };

  const bossDefeated = () => {
    G.inBoss = false;
    G.bossesDefeated++;
    const pts = BOSS.bonusPointsPerRound * G.round;
    G.score += pts;
    addFloat(`${G.bossName} defeated! +${pts}`, "reward");
    playVictory(); // stops the boss music and plays the fanfare
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    checkRewards();
    const won = rollBonus(G.bonus);
    if (!G.bonus) {
      G.bonus = won;
      later(() => addFloat(`Bonus power-up: ${BONUS_POWERUPS[won].name}`, "reward"), 700);
      later(nextRound, 2600); // let the victory fanfare finish first
    } else {
      // Only one bonus can be held: ask whether to keep it or take the new one.
      G.pendingBonus = won;
      G.phase = "bossReward";
      Keyboard.dismiss();
      popOverlay();
      // Don't leave the choice screen silent: bring the main theme back once the fanfare is done.
      later(() => {
        if (G.phase === "bossReward") playMusic("main");
      }, 2600);
    }
    bump();
  };

  const chooseBonus = (takeNew: boolean) => {
    if (G.phase !== "bossReward") return;
    if (takeNew && G.pendingBonus) G.bonus = G.pendingBonus;
    G.pendingBonus = null;
    focusInput();
    nextRound();
  };

  /** A wrong letter or timeout ends the streak. */
  const breakCombo = () => {
    if (G.streak === 0) return;
    if (comboMultiplier(G.streak) > 1) later(() => addFloat("Combo lost", "bad"), 250);
    G.streak = 0;
  };

  const handleChar = (raw: string) => {
    if (G.phase !== "playing") return;
    const ch = raw.toLowerCase();
    if (!/^[a-z]$/.test(ch)) return;
    G.keys++;
    if (ch === G.word[G.pos]) {
      G.goodKeys++;
      G.pos++;
      G.wrongAt = null;
      play("key");
      if (G.pos === G.word.length) solved();
      else bump();
    } else {
      G.wordMisses++;
      G.missed.add(G.pos);
      breakCombo(); // even when a Shield saves the life
      G.wrongAt = G.pos;
      letterPop.setValue(1.35);
      Animated.spring(letterPop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      play("miss");
      if (G.shields > 0) {
        G.shields--;
        addFloat("Shield blocked it", "reward", G.pos);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        bump();
        return;
      }
      addFloat(G.lives === 1 ? "Miss" : "−1 life", "bad", G.pos);
      loseLife(1);
      if (G.lives <= 0) {
        G.phase = "between";
        fuse.stopAnimation();
        later(gameOver, 600);
      }
      bump();
    }
  };

  const solved = () => {
    const used = (Date.now() - G.wordStart) / 1000;
    let pts = scoreWord(G.round, used, G.wordLimit, G.wordMisses);
    let mult = 1;
    if (G.doubleWords > 0) {
      mult *= 2;
      G.doubleWords--;
    }
    if (G.tripleWords > 0) {
      mult *= 3;
      G.tripleWords--;
    }
    // Combo: a flawless word extends the streak, and the streak sets a points multiplier.
    const before = comboMultiplier(G.streak);
    if (G.wordMisses === 0) {
      G.streak++;
      G.bestStreak = Math.max(G.bestStreak, G.streak);
    }
    const combo = comboMultiplier(G.streak);
    if (combo > before) {
      later(() => addFloat(`Combo ×${combo}!`, "reward"), 300);
      comboPop.setValue(1.5);
      Animated.spring(comboPop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
    pts = Math.round(pts * mult * combo);
    G.score += pts;
    if (G.inBoss) G.bossHp = Math.max(0, G.bossHp - 1);
    G.wordsTyped++;
    if (!G.fastest || used < G.fastest.t) G.fastest = { t: used, w: G.word };
    G.phase = "between";
    G.look = "solved";
    fuse.stopAnimation();
    const hit = G.inBoss ? (G.bossHp > 0 ? " · hit!" : " · final blow!") : "";
    const tags = [mult > 1 ? `${mult}×` : "", combo > 1 ? `combo ×${combo}` : ""].filter(Boolean).join(", ");
    addFloat(`+${pts}${tags ? ` (${tags})` : ""}${G.wordMisses === 0 && !hit && !tags ? " flawless" : ""}${hit}`, "good");
    play("word");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    checkRewards();
    bump();
    later(advance, 260);
  };

  const timedOut = () => {
    G.phase = "between";
    G.look = "timedOut";
    G.wrongAt = null;
    breakCombo();
    play("timeout");
    if (G.shields > 0) {
      G.shields--;
      addFloat("Too slow · shield blocked it", "reward");
    } else {
      addFloat(G.lives === 1 ? "Too slow" : `Too slow · −${CONFIG.timeoutCost} life`, "bad");
      loseLife(CONFIG.timeoutCost);
    }
    bump();
    later(advance, 650);
  };

  const gameOver = () => {
    if (G.phase === "over") return;
    G.phase = "over";
    fuse.stopAnimation();
    playMusic(null);
    play("over");
    setIsNewBest(recordBest() && G.score > 0);
    Keyboard.dismiss();
    popOverlay();
    bump();
  };

  /** Saves the score as this difficulty's best if it beats it. Returns whether it did. */
  const recordBest = () => {
    const id = G.d.id;
    if (G.score <= bestRef.current[id]) return false;
    bestRef.current = { ...bestRef.current, [id]: G.score };
    setBest(bestRef.current);
    saveBest(id, G.score);
    return true;
  };

  /** Pause screen: end this run and go back to the main menu. The score still counts as a best. */
  const quitToMenu = () => {
    setConfirmQuit(false);
    recordBest();
    Keyboard.dismiss();
    toTitle();
  };

  const pause = () => {
    if (G.phase !== "playing") return;
    fuse.stopAnimation(v => {
      G.pausedRemaining = v;
    });
    G.phase = "paused";
    setConfirmQuit(false);
    pauseMusic();
    popOverlay();
    bump();
  };

  const resume = () => {
    if (G.phase !== "paused") return;
    const elapsedFrac = 1 - G.pausedRemaining;
    G.wordStart = Date.now() - elapsedFrac * G.wordLimit * 1000;
    G.frozen = false; // pausing uses up what was left of a Freeze
    G.phase = "playing";
    resumeMusic();
    focusInput();
    runClock(G.pausedRemaining);
    bump();
  };

  /* ---------- rewards & power-ups ---------- */
  const checkRewards = () => {
    while (G.score >= G.nextRewardAt) {
      G.rewardsEarned++;
      G.nextRewardAt = rewardThreshold(G.rewardsEarned);
      if (G.inventory.length < REWARDS.bucketSize) {
        const id = rollPowerUp();
        G.inventory.push(id);
        later(() => addFloat(`New power-up: ${POWERUPS[id].name}`, "reward"), 280);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        later(() => addFloat("Bucket full · reward lost", "bad"), 280);
      }
    }
  };

  /** Seconds left on the current word's clock. */
  const remainingSeconds = () =>
    G.frozen || G.phase === "paused"
      ? G.pausedRemaining * G.wordLimit
      : Math.max(0, G.wordLimit - (Date.now() - G.wordStart) / 1000);

  /** Restart the clock with `seconds` left out of the word's (possibly new) limit. */
  const setClock = (seconds: number) => {
    const frac = Math.min(1, seconds / G.wordLimit);
    if (G.frozen) {
      G.pausedRemaining = frac;
      fuse.setValue(frac);
    } else {
      G.wordStart = Date.now() - (1 - frac) * G.wordLimit * 1000;
      runClock(frac);
    }
  };

  /** Slow-Mo time for `words` words, starting with the current one. */
  const slowFor = (words: number) => {
    const slowLimit = G.limit * REWARDS.slowFactor;
    if (G.wordLimit >= slowLimit) {
      G.slowWords += words; // this word is already slowed; extend to more words
    } else {
      const left = remainingSeconds() + (slowLimit - G.wordLimit);
      G.wordLimit = slowLimit;
      G.slowWords += words - 1; // the current word is the first of them
      setClock(left);
    }
  };

  /** Stops the clock for `seconds`. Returns a message if it's already frozen. */
  const freezeFor = (seconds: number): string | null => {
    if (G.frozen) return "Clock is already frozen";
    const frac = remainingSeconds() / G.wordLimit;
    fuse.stopAnimation();
    fuse.setValue(frac);
    G.pausedRemaining = frac;
    G.frozen = true;
    const wordId = G.wordId;
    later(() => {
      if (!G.frozen || G.wordId !== wordId || G.phase !== "playing") return;
      G.frozen = false;
      setClock(G.pausedRemaining * G.wordLimit);
      bump();
    }, seconds * 1000);
    return null;
  };

  /** Applies a bonus power-up. Returns a message if it can't be used right now. */
  const applyBonus = (id: BonusId): string | null => {
    switch (id) {
      case "megaLife": {
        if (G.lives >= MAX_LIVES) return "Lives are full";
        const before = G.lives;
        G.lives = Math.min(MAX_LIVES, G.lives + BONUS.megaLives);
        for (let i = before; i < G.lives; i++) {
          pips[i].setValue(1.8);
          Animated.spring(pips[i], { toValue: 1, friction: 4, useNativeDriver: true }).start();
        }
        return null;
      }
      case "timeWarp":
        slowFor(BONUS.warpWords);
        return null;
      case "fortress":
        G.shields += BONUS.fortressShields;
        return null;
      case "jackpot":
        G.tripleWords += BONUS.jackpotWords;
        return null;
      case "deepFreeze":
        return freezeFor(BONUS.deepFreezeSeconds);
      case "autoType":
        G.pos = G.word.length;
        G.wrongAt = null;
        solved(); // counts as finishing the word (a hit, in a boss fight)
        return null;
    }
  };

  const activateBonus = () => {
    if (G.phase !== "playing" || !G.bonus) return;
    const id = G.bonus;
    const blocked = applyBonus(id);
    if (blocked) {
      addFloat(blocked, "bad");
    } else {
      G.bonus = null;
      G.powerUpsUsed++;
      addFloat(BONUS_POWERUPS[id].name, "reward");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      play("round");
    }
    focusInput();
    bump();
  };

  /** Applies a power-up. Returns a message if it can't be used right now (it stays in the bucket). */
  const applyPowerUp = (id: PowerUpId): string | null => {
    switch (id) {
      case "life": {
        if (G.lives >= MAX_LIVES) return "Lives are full";
        G.lives++;
        const p = pips[G.lives - 1];
        p.setValue(1.8);
        Animated.spring(p, { toValue: 1, friction: 4, useNativeDriver: true }).start();
        return null;
      }
      case "refill":
        G.frozen = false;
        setClock(G.wordLimit);
        return null;
      case "skip":
        G.phase = "between";
        G.look = "skipped";
        G.wrongAt = null;
        fuse.stopAnimation();
        later(advance, 220);
        return null;
      case "slow":
        slowFor(REWARDS.slowWords);
        return null;
      case "shield":
        G.shields++;
        return null;
      case "freeze":
        return freezeFor(REWARDS.freezeSeconds);
      case "double":
        G.doubleWords += REWARDS.doubleWords;
        return null;
    }
  };

  const activatePowerUp = (slot: number) => {
    if (G.phase !== "playing") return;
    const id = G.inventory[slot];
    if (!id) return;
    const blocked = applyPowerUp(id);
    if (blocked) {
      addFloat(blocked, "bad");
    } else {
      G.inventory.splice(slot, 1);
      G.powerUpsUsed++;
      addFloat(POWERUPS[id].name, "reward");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      play("round");
    }
    focusInput();
    bump();
  };

  const toggleMusic = () => {
    const on = !musicOn;
    setMusicOnState(on);
    setMusicEnabled(on);
    saveMusic(on);
  };

  const toggleMute = () => {
    const m = !muted;
    setMutedState(m);
    setMuted(m);
    saveMuted(m);
  };

  /* ---------- input ---------- */
  const onChangeText = (t: string) => {
    const prev = lastText.current;
    let added = "";
    if (t.length > prev.length) added = t.startsWith(prev) ? t.slice(prev.length) : t.slice(-1);
    lastText.current = t;
    if (G.phase === "paused" && added) resume();
    for (const ch of added) {
      if (ch >= "1" && ch <= String(REWARDS.bucketSize)) activatePowerUp(Number(ch) - 1);
      else if (ch === String(REWARDS.bucketSize + 1)) activateBonus();
      else handleChar(ch);
    }
    if (t.length > 40) resetInput();
  };
  const onSubmit = () => {
    if (G.phase === "title" || G.phase === "over") startGame();
    else if (G.phase === "paused") resume();
  };

  /* ---------- render ---------- */
  const total = wordsInRound(G.round);
  const oneLife = G.d.lives === 1;
  const showNoLives = oneLife && G.lives <= 1; // Impossible, unless an Extra Life was used
  const low = !oneLife && G.lives > 0 && G.lives <= Math.ceil(G.d.lives * 0.3);
  const bestHere = best[G.d.id];
  const fontSize = currentFontSize();
  const hotOpacity = fuse.interpolate({ inputRange: [0, 0.3, 0.31, 1], outputRange: [1, 1, 0, 0] });
  const accuracy = G.keys ? `${Math.round((G.goodKeys / G.keys) * 100)}%` : "–";
  const prevLimit = G.round > 1 ? timeForRound(G.round - 1, G.d) : G.limit;
  let bannerNote = "";
  if (G.round > 1) {
    bannerNote = G.limit < prevLimit ? `Clock −${formatSeconds(prevLimit - G.limit)}` : "Clock at its fastest";
    if (wordsInRound(G.round) > wordsInRound(G.round - 1)) bannerNote += " · Longer round";
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, kbHeight) + 12 }]}>
      <StatusBar style={isDark || G.inBoss ? "light" : "dark"} />

      {/* HUD */}
      <View style={s.hud}>
        <View style={s.stat}>
          <Text style={s.label}>SCORE</Text>
          <Text style={s.value}>{G.score.toLocaleString()}</Text>
          <Text style={s.meta}>
            {G.d.label} · Best {Math.max(bestHere, G.score).toLocaleString()}
          </Text>
        </View>
        <ComboBadge c={c} streak={G.streak} pop={comboPop} />
        <View style={[s.stat, { alignItems: "flex-end" }]}>
          <Text style={s.label}>ROUND</Text>
          <Text style={s.value}>{G.round}</Text>
          <Text style={s.meta}>
            {G.inBoss ? `boss · ${G.bossHp} of ${G.bossMaxHp} HP` : `word ${Math.min(G.wordInRound + 1, total)} of ${total}`}
          </Text>
        </View>
      </View>
      <View style={s.livesRow}>
        <Text style={[s.label, (low || showNoLives) && { color: c.miss }]}>
          {showNoLives ? "NO LIVES · ONE MISS ENDS IT" : `LIVES ${G.lives}`}
        </Text>
        <View style={[s.pips, showNoLives && { display: "none" }]}>
          {pips.slice(0, Math.max(G.d.lives, G.lives)).map((p, i) => {
            const lost = i >= G.lives;
            return (
              <Animated.View
                key={i}
                style={[
                  s.pip,
                  { backgroundColor: lost ? c.line : low ? c.miss : c.ink },
                  { transform: [{ scale: p }], opacity: !lost && low ? pulse : 1 },
                ]}
              />
            );
          })}
        </View>
      </View>

      {G.inBoss && G.phase !== "banner" && (
        <View style={s.bossBar} accessibilityLabel={`${G.bossName}: ${G.bossHp} of ${G.bossMaxHp} health left`}>
          <Text style={[s.label, { color: c.miss }]} numberOfLines={1}>
            BOSS · {G.bossName.toUpperCase()}
          </Text>
          <View style={s.bossHpRow}>
            {Array.from({ length: G.bossMaxHp }, (_, i) => (
              <View key={i} style={[s.bossHpSeg, { backgroundColor: i < G.bossHp ? c.miss : c.line }]} />
            ))}
          </View>
        </View>
      )}

      {/* Stage */}
      <Pressable
        style={s.stage}
        onPress={focusInput}
        onLayout={e => setStageWidth(e.nativeEvent.layout.width)}
        accessibilityLabel="Tap to bring up the keyboard"
      >
        <View style={s.wordWrap}>
          {floats.map(f => (
            <Animated.Text
              key={f.id}
              style={[
                s.float,
                { color: f.kind === "good" ? c.good : f.kind === "reward" ? c.accent : c.miss },
                {
                  opacity: f.anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
                  transform: [
                    { translateX: f.x },
                    { translateY: f.anim.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
                  ],
                },
              ]}
            >
              {f.text}
            </Animated.Text>
          ))}
          <Animated.View
            style={[s.word, { transform: [{ translateX: shake }] }]}
            accessibilityLabel={`Word ${G.word}`}
          >
            {[...G.word].map((ch, i) => {
              const done = i < G.pos;
              const wasMissed = G.missed.has(i);
              const current = i === G.pos && G.phase === "playing";
              const wrong = G.wrongAt === i;
              let color = c.ghost;
              if (done) color = wasMissed ? c.miss : c.ink;
              if (wrong) color = c.miss;
              if (G.look === "solved") color = c.good;
              if (G.look === "timedOut") color = c.miss;
              if (G.look === "skipped") color = c.muted;
              return (
                <Animated.View
                  key={i}
                  style={[
                    s.letterBox,
                    wrong && { backgroundColor: c.missSoft },
                    wrong && { transform: [{ scale: letterPop }] },
                  ]}
                >
                  <Text style={[s.letter, { fontSize, color }]} allowFontScaling={false}>
                    {ch}
                  </Text>
                  <View
                    style={[
                      s.underline,
                      {
                        backgroundColor: wrong || (done && wasMissed) ? c.miss : current ? c.accent : "transparent",
                        height: Math.max(3, fontSize * 0.07),
                      },
                    ]}
                  />
                </Animated.View>
              );
            })}
          </Animated.View>
        </View>

        <View style={s.fuse}>
          <View style={s.fuseTrack}>
            <Animated.View style={[s.fuseFill, { backgroundColor: c.accent, transform: [{ scaleX: fuse }] }]} />
            <Animated.View
              style={[s.fuseFill, s.fuseHot, { backgroundColor: c.miss, opacity: hotOpacity, transform: [{ scaleX: fuse }] }]}
            />
          </View>
          <View style={s.fuseRow}>
            <Text style={s.meta}>
              Time per word <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{formatSeconds(G.phase === "banner" || G.phase === "title" ? G.limit : G.wordLimit)}
              </Text>
            </Text>
            <Remaining G={G} style={s.meta} />
          </View>
        </View>

        <Text style={s.hint}>
          {G.phase === "playing" && G.round === 1 && G.wordInRound === 0
            ? oneLife
              ? "Type the word. One wrong letter ends the game."
              : "Type the word. Wrong letters cost a life."
            : kbHeight === 0 && (G.phase === "playing" || G.phase === "banner")
              ? "Tap here to bring up the keyboard"
              : " "}
        </Text>
      </Pressable>

      <PowerUpTray c={c} G={G} onUse={activatePowerUp} onUseBonus={activateBonus} />

      <View style={s.controls}>
        <Pressable style={s.chip} onPress={() => (G.phase === "paused" ? resume() : pause())} hitSlop={8}>
          <Text style={s.chipText}>{G.phase === "paused" ? "RESUME" : "PAUSE"}</Text>
        </Pressable>
        <Pressable style={s.chip} onPress={toggleMute} hitSlop={8}>
          <Text style={s.chipText}>{muted ? "SOUND OFF" : "SOUND ON"}</Text>
        </Pressable>
        <Pressable style={s.chip} onPress={toggleMusic} hitSlop={8}>
          <Text style={s.chipText}>{musicOn ? "MUSIC ON" : "MUSIC OFF"}</Text>
        </Pressable>
      </View>

      <TextInput
        ref={inputRef}
        style={s.hiddenInput}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        submitBehavior="submit"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        caretHidden
        contextMenuHidden
        importantForAutofill="no"
        textContentType="none"
        keyboardType={Platform.OS === "android" ? "visible-password" : "ascii-capable"}
        returnKeyType="done"
        accessibilityLabel="Type here"
      />

      {/* Off-screen sample of the word font, measured once (see glyphPerPx) */}
      <View style={s.probe} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text
          style={[s.letter, { fontSize: PROBE_FONT }]}
          allowFontScaling={false}
          numberOfLines={1}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setGlyphPerPx(w / (PROBE_TEXT.length * PROBE_FONT));
          }}
        >
          {PROBE_TEXT}
        </Text>
      </View>

      {/* Red flash on a miss */}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.flash, { opacity: flash }]} />

      {/* Overlays */}
      {G.phase === "title" && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={s.eyebrow}>A TYPING SURVIVAL GAME</Text>
          <Text style={s.h1}>TypeSpeedy</Text>
          <Text style={s.demo}>
            <Text style={{ color: c.ink }}>surv</Text>
            <Text style={{ color: c.miss, textDecorationLine: "underline" }}>i</Text>
            <Text style={{ color: c.ink }}>v</Text>
            <Text style={{ color: c.ghost }}>al</Text>
          </Text>
          <Text style={s.body}>
            Type each word before the clock runs out. Wrong letters cost lives, every round gets faster, and a boss waits
            at the end of each one. How long can you last?
          </Text>
          <Text style={s.label}>DIFFICULTY</Text>
          <View style={s.diffGrid} accessibilityRole="radiogroup">
            {DIFFICULTY_ORDER.map(id => (
              <DifficultyCard
                key={id}
                c={c}
                d={DIFFICULTIES[id]}
                best={best[id]}
                selected={difficulty === id}
                onPress={() => chooseDifficulty(id)}
              />
            ))}
          </View>
          <Btn c={c} label={`Start ${G.d.label}`} onPress={startGame} />
          <Btn c={c} label="How to play" onPress={() => setShowHelp(true)} secondary />
        </Overlay>
      )}

      {G.phase === "title" && showHelp && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={s.eyebrow}>HOW TO PLAY</Text>
          <Text style={s.h2}>The rules</Text>
          <Rule c={c} k="POINTS" v="Every word you finish scores. Faster and flawless words score more." />
          <Rule
            c={c}
            k="LIVES"
            v={
              oneLife
                ? "None. One wrong letter or one slow word ends the game."
                : `You have ${G.d.lives}. Each wrong letter turns red and costs one. Running out of time costs one too.`
            }
          />
          <Rule c={c} k="ROUNDS" v="Ten words a round. The clock gets shorter every round, and late rounds get longer." />
          <Rule
            c={c}
            k="COMBO"
            v={`Finish words with no wrong letters to build a streak: ${COMBO_TIERS.map(t => `${t.at} in a row for ×${t.mult}`).join(", ")}. A wrong letter or a timeout resets it.`}
          />
          <Rule
            c={c}
            k="BOSSES"
            v="Every round ends with a boss. Type its words to beat it and win a gold bonus power-up, even if your bucket is full. You can hold one bonus at a time."
          />
          <Rule
            c={c}
            k="REWARDS"
            v="Score points to earn power-ups like extra lives, more time and skips. Hold up to 3 and tap one to use it. While your bucket is full, new rewards are lost."
          />
          <Btn c={c} label="Got it" onPress={() => setShowHelp(false)} />
        </Overlay>
      )}

      {G.phase === "banner" && (
        <View style={[StyleSheet.absoluteFill, s.bannerWrap]} pointerEvents="none">
          {G.inBoss ? (
            <Animated.View style={[s.banner, { transform: [{ scale: overlayPop }] }]}>
              <Text style={[s.label, { color: c.miss, letterSpacing: 4 }]}>BOSS FIGHT</Text>
              <Text style={s.bossName}>{G.bossName}</Text>
              <Text style={s.bannerSub}>
                Type <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{G.bossMaxHp}</Text> words to
                defeat it ·{" "}
                <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{formatSeconds(G.limit)}</Text> per word
              </Text>
              <Text style={[s.bannerNote, { color: c.gold }]}>Win a gold bonus power-up</Text>
            </Animated.View>
          ) : (
          <Animated.View style={[s.banner, { transform: [{ scale: overlayPop }] }]}>
            <Text style={s.label}>ROUND</Text>
            <Text style={s.bannerBig}>{G.round}</Text>
            <Text style={s.bannerSub}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{total}</Text> words ·{" "}
              <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{formatSeconds(G.limit)}</Text> per word
            </Text>
            {bannerNote ? <Text style={s.bannerNote}>{bannerNote}</Text> : null}
          </Animated.View>
          )}
        </View>
      )}

      {G.phase === "bossReward" && G.bonus && G.pendingBonus && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={[s.eyebrow, { color: c.gold }]}>BOSS DEFEATED</Text>
          <Text style={s.h2}>Keep or swap?</Text>
          <Text style={s.body}>You won a new bonus power-up, but you can only hold one.</Text>
          <BonusCard c={c} tag="NEW" id={G.pendingBonus} />
          <BonusCard c={c} tag="YOU HAVE" id={G.bonus} />
          <Btn c={c} label={`Take ${BONUS_POWERUPS[G.pendingBonus].name}`} onPress={() => chooseBonus(true)} />
          <Btn c={c} label={`Keep ${BONUS_POWERUPS[G.bonus].name}`} onPress={() => chooseBonus(false)} secondary />
        </Overlay>
      )}

      {G.phase === "paused" && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={s.eyebrow}>PAUSED</Text>
          <Text style={s.h2}>Take a breath</Text>
          <Text style={s.body}>The clock is stopped. Your word will be waiting.</Text>
          {confirmQuit ? (
            <>
              <Text style={[s.body, { color: c.ink }]}>
                Quit this run? Your score of {G.score.toLocaleString()} still counts toward your best.
              </Text>
              <Btn c={c} label="Yes, quit to main menu" onPress={quitToMenu} />
              <Btn c={c} label="Keep playing" onPress={resume} secondary />
            </>
          ) : (
            <>
              <Btn c={c} label="Resume" onPress={resume} />
              <Btn c={c} label="Quit to main menu" onPress={() => setConfirmQuit(true)} secondary />
            </>
          )}
        </Overlay>
      )}

      {G.phase === "over" && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={[s.eyebrow, { color: c.miss }]}>
            {G.d.label.toUpperCase()} · {oneLife ? "GAME OVER" : "OUT OF LIVES"}
          </Text>
          <Text style={s.h2}>You reached round {G.round}</Text>
          <View style={s.results}>
            <Result
              c={c}
              k="SCORE"
              v={G.score.toLocaleString()}
              note={isNewBest ? `New ${G.d.label} best` : `${G.d.label} best ${bestHere.toLocaleString()}`}
            />
            <Result c={c} k="WORDS TYPED" v={String(G.wordsTyped)} />
            <Result c={c} k="ACCURACY" v={accuracy} />
            <Result c={c} k="FASTEST WORD" v={G.fastest ? `${G.fastest.t.toFixed(2)}s` : "–"} />
          </View>
          <Text style={s.body}>
            {G.fastest ? `Your quickest was “${G.fastest.w}”.` : "Finish a word to get on the board."}
            {G.bossesDefeated > 0
              ? ` You beat ${G.bossesDefeated} boss${G.bossesDefeated > 1 ? "es" : ""}.`
              : ""}
            {G.bestStreak >= 3 ? ` Longest streak: ${G.bestStreak} words.` : ""}
          </Text>
          <Btn c={c} label="Play again" onPress={startGame} />
          <Btn c={c} label="Main menu" onPress={toTitle} secondary />
        </Overlay>
      )}
    </View>
  );
}

function powerUpColor(c: Palette, id: PowerUpId): string {
  return {
    life: c.miss,
    refill: c.accent,
    skip: c.ink,
    slow: c.good,
    shield: c.violet,
    freeze: c.ice,
    double: c.gold,
  }[id];
}

/** The 3-slot power-up bucket, what the next reward needs, and which effects are running. */
/** Center of the top bar: the current combo multiplier and streak. */
function ComboBadge({ c, streak, pop }: { c: Palette; streak: number; pop: Animated.Value }) {
  const s = styles(c);
  const mult = comboMultiplier(streak);
  const next = nextComboTier(streak);
  const active = mult > 1;
  return (
    <View style={[s.stat, s.combo]} accessibilityLabel={`Combo ${mult} times, streak ${streak}`}>
      <Text style={[s.label, active && { color: c.gold }]}>COMBO</Text>
      <Animated.Text style={[s.value, { color: active ? c.gold : c.ghost, transform: [{ scale: pop }] }]}>
        ×{mult}
      </Animated.Text>
      <Text style={s.meta} numberOfLines={1}>
        {next ? `${streak} · ${next.at - streak} to ×${next.mult}` : `${streak} · max`}
      </Text>
    </View>
  );
}

function BonusCard({ c, tag, id }: { c: Palette; tag: string; id: BonusId }) {
  const s = styles(c);
  return (
    <View style={[s.bonusSlot, { borderStyle: "solid" }]}>
      <Text style={[s.label, { color: c.gold }]}>{tag}</Text>
      <Text style={[s.slotName, { color: c.gold }]}>{BONUS_POWERUPS[id].name}</Text>
      <Text style={s.slotEffect}>{BONUS_POWERUPS[id].effect}</Text>
    </View>
  );
}

function PowerUpTray({
  c,
  G,
  onUse,
  onUseBonus,
}: {
  c: Palette;
  G: GameState;
  onUse: (slot: number) => void;
  onUseBonus: () => void;
}) {
  const s = styles(c);
  const full = G.inventory.length >= REWARDS.bucketSize;
  const canUse = G.phase === "playing";
  const slowLeft = G.slowWords + (G.wordLimit > G.limit && G.phase !== "banner" ? 1 : 0);
  const active: { text: string; color: string }[] = [];
  if (G.frozen) active.push({ text: "Frozen", color: c.ice });
  if (G.shields > 0) active.push({ text: G.shields > 1 ? `Shield ×${G.shields}` : "Shield on", color: c.violet });
  if (slowLeft > 0) active.push({ text: `Slow-Mo · ${slowLeft} word${slowLeft > 1 ? "s" : ""}`, color: c.good });
  if (G.doubleWords > 0) active.push({ text: `2× points · ${G.doubleWords} word${G.doubleWords > 1 ? "s" : ""}`, color: c.gold });
  if (G.tripleWords > 0) active.push({ text: `3× points · ${G.tripleWords} word${G.tripleWords > 1 ? "s" : ""}`, color: c.gold });

  return (
    <View style={s.tray}>
      <View style={s.trayHead}>
        <Text style={s.label}>POWER-UPS</Text>
        <Text style={[s.meta, full && { color: c.miss }]} numberOfLines={1}>
          {full ? "Bucket full · use one to earn more" : `Next at ${G.nextRewardAt.toLocaleString()} pts`}
        </Text>
      </View>
      {G.bonus ? (
        <Pressable
          onPress={onUseBonus}
          disabled={!canUse}
          style={({ pressed }) => [s.bonusSlot, { opacity: canUse ? 1 : 0.5 }, pressed && { transform: [{ scale: 0.98 }] }]}
          accessibilityRole="button"
          accessibilityLabel={`Use bonus ${BONUS_POWERUPS[G.bonus].name}: ${BONUS_POWERUPS[G.bonus].effect}`}
        >
          <View style={s.bonusRow}>
            <Text style={[s.label, { color: c.gold }]}>BONUS</Text>
            <Text style={[s.slotName, { color: c.gold }]} numberOfLines={1}>
              {BONUS_POWERUPS[G.bonus].name}
            </Text>
          </View>
          <Text style={s.slotEffect} numberOfLines={1}>
            {BONUS_POWERUPS[G.bonus].effect}
          </Text>
        </Pressable>
      ) : (
        <View style={[s.bonusSlot, s.bonusEmpty]}>
          <Text style={[s.slotEmptyText, { color: c.gold, opacity: 0.7 }]}>Beat a boss to win a gold bonus</Text>
        </View>
      )}
      <View style={s.slots}>
        {Array.from({ length: REWARDS.bucketSize }, (_, i) => {
          const id = G.inventory[i];
          if (!id)
            return (
              <View key={i} style={[s.slot, s.slotEmpty]}>
                <Text style={s.slotEmptyText}>Empty</Text>
              </View>
            );
          const color = powerUpColor(c, id);
          return (
            <Pressable
              key={i}
              onPress={() => onUse(i)}
              disabled={!canUse}
              style={({ pressed }) => [
                s.slot,
                { borderColor: color, opacity: canUse ? 1 : 0.5 },
                pressed && { transform: [{ scale: 0.96 }] },
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Use ${POWERUPS[id].name}: ${POWERUPS[id].effect}`}
            >
              <Text style={[s.slotName, { color }]} numberOfLines={1}>
                {POWERUPS[id].name}
              </Text>
              <Text style={s.slotEffect} numberOfLines={2}>
                {POWERUPS[id].effect}
              </Text>
            </Pressable>
          );
        })}
      </View>
      {active.length > 0 && (
        <View style={s.activeRow}>
          {active.map(a => (
            <View key={a.text} style={[s.activeChip, { borderColor: a.color }]}>
              <Text style={[s.activeText, { color: a.color }]}>{a.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function DifficultyCard({
  c,
  d,
  best,
  selected,
  onPress,
}: {
  c: Palette;
  d: Difficulty;
  best: number;
  selected: boolean;
  onPress: () => void;
}) {
  const s = styles(c);
  const health = d.lives === 1 ? "No Lives" : `${d.lives} lives`;
  return (
    <Pressable
      onPress={onPress}
      style={[s.diffCard, selected && { borderColor: c.accent, backgroundColor: c.accentSoft }]}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${d.label}: ${formatSeconds(d.startTime)} down to ${formatSeconds(d.minTime)} per word, ${health}, ${d.words}`}
    >
      <Text style={[s.diffLabel, selected && { color: c.accent }]}>{d.label}</Text>
      <Text style={s.diffDetail}>
        {formatSeconds(d.startTime)} · {health}
      </Text>
      <Text style={s.diffWords}>{d.words}</Text>
      {best > 0 ? <Text style={s.diffBest}>Best {best.toLocaleString()}</Text> : null}
    </Pressable>
  );
}

/* ---------- small components ---------- */

// IBM Plex Mono advances 0.6em per glyph; 0.62 is a safe starting estimate until measured.
const MONO_ADVANCE = 0.62;
const LETTER_PAD = 2; // letterBox paddingHorizontal, both sides
const WORD_MARGIN = 8; // breathing room so the shake doesn't touch the edges
const MAX_WORD_FONT = 76;
/** Words never draw smaller than this; longer words that wouldn't fit at it are left out. */
const MIN_READABLE_FONT = 40;
const PROBE_FONT = 100; // size of the off-screen font sample
const PROBE_TEXT = "mmmmmmmmmm";

/** Largest font size (MIN_READABLE_FONT to MAX_WORD_FONT) at which a word of `len` letters fits. */
function wordFontSize(len: number, availWidth: number, glyphPerPx: number) {
  const usable = availWidth - WORD_MARGIN - len * LETTER_PAD;
  return Math.max(MIN_READABLE_FONT, Math.min(MAX_WORD_FONT, Math.floor(usable / (len * glyphPerPx))));
}

/** Most letters that fit across the play area at MIN_READABLE_FONT. */
function maxLettersAt(availWidth: number, glyphPerPx: number) {
  return Math.max(3, Math.floor((availWidth - WORD_MARGIN) / (MIN_READABLE_FONT * glyphPerPx + LETTER_PAD)));
}

/** Seconds left on the clock, ticking on its own so the whole game doesn't re-render. */
function Remaining({ G, style }: { G: GameState; style: object }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), 100);
    return () => clearInterval(id);
  }, []);
  let remaining = G.limit;
  if (G.phase === "playing" && G.frozen) remaining = G.pausedRemaining * G.wordLimit;
  else if (G.phase === "playing") remaining = Math.max(0, G.wordLimit - (Date.now() - G.wordStart) / 1000);
  else if (G.phase === "paused") remaining = G.pausedRemaining * G.wordLimit;
  else if (G.phase === "between" || G.phase === "over") remaining = 0;
  return <Text style={[style, { fontVariant: ["tabular-nums"] }]}>{remaining.toFixed(1)}s</Text>;
}

function Overlay({ c, pop, children }: { c: Palette; pop: Animated.Value; children: React.ReactNode }) {
  const s = styles(c);
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, s.scrim, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
      <Animated.View style={[s.panel, { transform: [{ scale: pop }] }]}>
        <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={s.panelContent} showsVerticalScrollIndicator={false} bounces={false}>
          {children}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

function Rule({ c, k, v }: { c: Palette; k: string; v: string }) {
  const s = styles(c);
  return (
    <View style={s.rule}>
      <Text style={[s.label, s.ruleKey]}>{k}</Text>
      <Text style={s.ruleText}>{v}</Text>
    </View>
  );
}

function Result({ c, k, v, note }: { c: Palette; k: string; v: string; note?: string }) {
  const s = styles(c);
  return (
    <View style={s.result}>
      <Text style={s.label}>{k}</Text>
      <Text style={s.value}>{v}</Text>
      {note ? <Text style={[s.meta, { color: c.good, fontFamily: fonts.bodyStrong }]}>{note}</Text> : null}
    </View>
  );
}

function Btn({ c, label, onPress, secondary }: { c: Palette; label: string; onPress: () => void; secondary?: boolean }) {
  const s = styles(c);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        secondary && s.btnSecondary,
        pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
      ]}
      accessibilityRole="button"
    >
      <Text style={[s.btnText, secondary && { color: c.ink }]}>{label}</Text>
    </Pressable>
  );
}

/* ---------- styles ---------- */

const cache = new Map<Palette, ReturnType<typeof make>>();
function styles(c: Palette) {
  let v = cache.get(c);
  if (!v) cache.set(c, (v = make(c)));
  return v;
}

function make(c: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg, paddingHorizontal: 18 },
    hud: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 8 },
    combo: { alignItems: "center", flexShrink: 1 },
    stat: { gap: 2 },
    label: { fontFamily: fonts.bodyStrong, fontSize: 11, letterSpacing: 1.3, color: c.muted },
    value: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, color: c.ink, fontVariant: ["tabular-nums"] },
    meta: { fontFamily: fonts.body, fontSize: 13, color: c.muted },
    livesRow: { marginTop: 14, alignItems: "center", gap: 6 },
    pips: { flexDirection: "row", gap: 5 },
    pip: { width: 22, height: 16, borderRadius: 3 },

    stage: { flex: 1, alignItems: "center", justifyContent: "center", gap: 28 },
    wordWrap: { alignItems: "center", justifyContent: "flex-end" },
    word: { flexDirection: "row" },
    letterBox: { alignItems: "center", borderRadius: 8, paddingHorizontal: 1 },
    letter: { fontFamily: fonts.word, includeFontPadding: false },
    underline: { alignSelf: "stretch", marginHorizontal: "8%", borderRadius: 2, marginTop: 2 },
    float: { position: "absolute", top: -34, width: 340, textAlign: "center", fontFamily: fonts.display, fontSize: 22 },

    fuse: { width: "100%", maxWidth: 560, gap: 8 },
    fuseTrack: { height: 10, borderRadius: 999, backgroundColor: c.line, overflow: "hidden" },
    fuseFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, transformOrigin: "left" },
    fuseHot: {},
    fuseRow: { flexDirection: "row", justifyContent: "space-between" },
    hint: { fontFamily: fonts.body, fontSize: 13, color: c.muted, textAlign: "center" },

    tray: { gap: 6, marginBottom: 10 },
    bonusSlot: {
      borderWidth: 1.5,
      borderColor: c.gold,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: c.surface,
      gap: 1,
    },
    bonusRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
    bonusEmpty: { borderStyle: "dashed", backgroundColor: "transparent", alignItems: "center", paddingVertical: 8 },
    bossBar: { marginTop: 14, gap: 6, alignItems: "center" },
    bossHpRow: { flexDirection: "row", gap: 6, alignSelf: "stretch", justifyContent: "center" },
    bossHpSeg: { flex: 1, maxWidth: 70, height: 10, borderRadius: 3 },
    bossName: {
      fontFamily: fonts.display,
      fontSize: 44,
      lineHeight: 48,
      color: c.ink,
      textAlign: "center",
      letterSpacing: -1,
      paddingHorizontal: 12,
    },
    trayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10 },
    slots: { flexDirection: "row", gap: 8 },
    slot: {
      flex: 1,
      minHeight: 56,
      borderWidth: 1.5,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 7,
      backgroundColor: c.surface,
      gap: 1,
    },
    slotEmpty: { borderStyle: "dashed", borderColor: c.line, backgroundColor: "transparent", alignItems: "center", justifyContent: "center" },
    slotEmptyText: { fontFamily: fonts.body, fontSize: 12, color: c.ghost },
    slotName: { fontFamily: fonts.display, fontSize: 15 },
    slotEffect: { fontFamily: fonts.body, fontSize: 11, lineHeight: 14, color: c.muted },
    activeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    activeChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
    activeText: { fontFamily: fonts.bodyStrong, fontSize: 11 },
    controls: { flexDirection: "row", justifyContent: "center", gap: 10 },
    chip: { borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { fontFamily: fonts.bodyStrong, fontSize: 11, letterSpacing: 1, color: c.muted },

    hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0, left: -10, top: 0 },
    // Wide enough that the sample is never clipped; parked above the screen.
    probe: { position: "absolute", top: -2000, left: 0, width: 5000, alignItems: "flex-start", opacity: 0 },
    flash: { borderWidth: 8, borderColor: c.miss, backgroundColor: c.missSoft },

    scrim: { backgroundColor: c.scrim, alignItems: "center", justifyContent: "center", padding: 18 },
    panel: {
      width: "100%",
      maxWidth: 520,
      backgroundColor: c.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: c.line,
      maxHeight: "100%",
      overflow: "hidden",
    },
    panelContent: { padding: 22, gap: 14 },
    diffGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10, marginTop: -6 },
    diffCard: {
      width: "48.5%",
      borderWidth: 1.5,
      borderColor: c.line,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 2,
    },
    diffLabel: { fontFamily: fonts.display, fontSize: 19, color: c.ink },
    diffDetail: { fontFamily: fonts.bodyStrong, fontSize: 12, color: c.ink, fontVariant: ["tabular-nums"] },
    diffWords: { fontFamily: fonts.body, fontSize: 12, lineHeight: 16, color: c.muted },
    diffBest: { fontFamily: fonts.bodyStrong, fontSize: 11, color: c.good, marginTop: 2 },
    btnSecondary: { backgroundColor: "transparent", borderWidth: 1, borderColor: c.line },
    eyebrow: { fontFamily: fonts.bodyStrong, fontSize: 11, letterSpacing: 1.6, color: c.accent },
    h1: { fontFamily: fonts.display, fontSize: 48, lineHeight: 50, color: c.ink, letterSpacing: -1 },
    h2: { fontFamily: fonts.display, fontSize: 34, lineHeight: 38, color: c.ink, letterSpacing: -0.5 },
    body: { fontFamily: fonts.body, fontSize: 15, lineHeight: 22, color: c.muted },
    demo: { fontFamily: fonts.word, fontSize: 30 },
    rule: { flexDirection: "row", gap: 12 },
    ruleKey: { width: 64, paddingTop: 3 },
    ruleText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: c.ink },
    results: { flexDirection: "row", flexWrap: "wrap", rowGap: 14 },
    result: { width: "50%", gap: 2 },
    btn: { backgroundColor: c.accent, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
    btnText: { fontFamily: fonts.bodyStrong, fontSize: 16, color: c.onAccent },

    bannerWrap: { alignItems: "center", justifyContent: "center", backgroundColor: c.scrim },
    banner: { alignItems: "center", gap: 6 },
    bannerBig: { fontFamily: fonts.display, fontSize: 110, lineHeight: 112, color: c.ink, letterSpacing: -3 },
    bannerSub: { fontFamily: fonts.body, fontSize: 15, color: c.muted },
    bannerNote: { fontFamily: fonts.bodyStrong, fontSize: 14, color: c.accent },
  });
}
