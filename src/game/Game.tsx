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
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputInstance,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Haptics from "expo-haptics";
import { buzz, setHapticsEnabled } from "./haptics";
import appConfig from "../../app.json";

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
import {
  PACK_BY_ID,
  THEMES,
  WORD_PACKS,
  meetsRequirement,
  newUnlockables,
  requirementText,
  themePalette,
  type PackId,
  type Theme,
  type ThemeId,
  type WordPack,
} from "./unlocks";
import { initSounds, pauseMusic, play, playMusic, playVictory, resumeMusic, setMusicEnabled, setMuted } from "./sound";
import {
  loadAchievements,
  loadDaily,
  loadPrefs,
  saveAchievements,
  saveBest,
  saveDaily,
  saveDailyStreak,
  saveDifficulty,
  saveLifetime,
  resetAchievements,
  resetStats,
  saveEffects,
  saveHaptics,
  saveMusic,
  saveMuted,
  savePack,
  saveTheme,
  type BestScores,
  type DailyRecord,
  type DailyStreak,
} from "./storage";
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
import {
  DAILY_DIFFICULTY,
  dailyStreams,
  freeStreams,
  prettyDate,
  timeUntilTomorrow,
  todayKey,
  yesterdayKey,
  type RandomStreams,
} from "./daily";
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_GROUPS,
  EMPTY_LIFETIME,
  addRun,
  emptyRun,
  newlyUnlocked,
  type Achievement,
  type AchievementContext,
  type LifetimeStats,
  type RunStats,
  type Unlocked,
} from "./achievements";

type Phase = "title" | "banner" | "playing" | "between" | "paused" | "over" | "bossReward";
type WordLook = "normal" | "solved" | "timedOut" | "skipped";
const APP_VERSION = `v${appConfig.expo.version}`;

type Toast = { eyebrow: string; name: string; desc: string };
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
  bossHistory: string[]; // bosses met this game, so names don't repeat
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
  daily: boolean; // playing today's Daily Challenge
  dailyDate: string;
  // For achievements
  bonusesUsed: number;
  shieldBlocks: number;
  bucketFilled: boolean;
  fastestLong: number | null; // quickest 7-letter word, in seconds
  fastestMid: number | null; // quickest word of 5+ letters, in seconds
  typingSeconds: number; // time spent on words, for the Stats screen
  flawlessBosses: number;
  clutchBosses: number;
  perfectRounds: number;
  roundMisses: number; // wrong letters + timeouts this round (boss included)
  bossMisses: number; // wrong letters + timeouts in this boss fight
  newAchievements: string[]; // names unlocked this game, for the game-over screen
  newUnlocks: string[]; // themes and word packs unlocked this game
  pack: string[] | null; // this game's word pack (null = the standard list)
  careerSaved: boolean; // this game's totals were added to the lifetime stats
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
    bossHistory: [],
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
    daily: false,
    dailyDate: "",
    bonusesUsed: 0,
    shieldBlocks: 0,
    bucketFilled: false,
    fastestLong: null,
    fastestMid: null,
    typingSeconds: 0,
    flawlessBosses: 0,
    clutchBosses: 0,
    perfectRounds: 0,
    roundMisses: 0,
    bossMisses: 0,
    newAchievements: [],
    newUnlocks: [],
    pack: null,
    careerSaved: true, // nothing to save until a game starts
  };
}

export default function Game() {
  const { isDark: systemDark } = usePalette();
  const [themeId, setThemeId] = useState<ThemeId>("classic");
  const [packId, setPackId] = useState<PackId>("classic");
  const packRef = useRef<PackId>("classic");
  const [showCustomize, setShowCustomize] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState<"stats" | "achievements" | null>(null);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [effectsOn, setEffectsOn] = useState(true);
  const effectsRef = useRef(true); // read by hitEffects(), which can run from an old render's timer
  const { c: baseColors, dark: isDark } = themePalette(themeId, systemDark);
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
  const [dailyRecord, setDailyRecord] = useState<DailyRecord | null>(null);
  const [dailyStreak, setDailyStreak] = useState<DailyStreak>({ count: 0, lastDate: "" });
  // Random numbers for word, boss and reward picks: seeded by the date in a Daily Challenge.
  const rng = useRef<RandomStreams>(freeStreams());
  const dailyStreakRef = useRef(0); // current day-streak count, for achievement checks
  dailyStreakRef.current = dailyStreak.count;
  const [unlocked, setUnlocked] = useState<Unlocked>({});
  const unlockedRef = useRef<Unlocked>({});
  const [lifetime, setLifetime] = useState<LifetimeStats>(EMPTY_LIFETIME);
  const lifetimeRef = useRef<LifetimeStats>(EMPTY_LIFETIME);
  const [showAchievements, setShowAchievements] = useState(false);
  // "Achievement unlocked" toasts, shown one at a time.
  const [toast, setToast] = useState<Toast | null>(null);
  const toastQueue = useRef<Toast[]>([]);
  const toastShowing = useRef(false);
  const toastAnim = useRef(new Animated.Value(0)).current;

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
    Promise.all([loadDaily(), loadAchievements()]).then(([d, a]) => {
      setDailyRecord(d.record);
      setDailyStreak(d.streak);
      dailyStreakRef.current = d.streak.count;
      // Keep anything unlocked while loading (unlikely, but don't lose it).
      unlockedRef.current = { ...a.unlocked, ...unlockedRef.current };
      setUnlocked(unlockedRef.current);
      lifetimeRef.current = a.lifetime;
      setLifetime(a.lifetime);
      checkAchievements(); // e.g. a Daily streak from before achievements existed
    });
    loadPrefs().then(p => {
      bestRef.current = p.best;
      setBest(p.best);
      setMutedState(p.muted);
      setMuted(p.muted);
      setMusicOnState(p.music);
      setMusicEnabled(p.music);
      setHapticsOn(p.haptics);
      setHapticsEnabled(p.haptics);
      setEffectsOn(p.effects);
      effectsRef.current = p.effects;
      setThemeId(p.theme);
      setPackId(p.pack);
      packRef.current = p.pack;
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
    buzz.notify(Haptics.NotificationFeedbackType.Error).catch(() => {});
    if (!effectsRef.current) return; // Settings: screen shake and flash turned off
    flash.setValue(1);
    Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: true }).start();
    shake.setValue(0);
    Animated.sequence(
      [-10, 10, -10, 10, -5, 5, 0].map(v => Animated.timing(shake, { toValue: v, duration: 45, useNativeDriver: true })),
    ).start();
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

  /* ---------- achievements ---------- */
  /** This game's stats, or null outside a game. */
  const runStats = (): RunStats | null => {
    if (G.phase === "title") return null;
    return {
      difficulty: G.d.id,
      daily: G.daily,
      over: G.phase === "over",
      score: G.score,
      round: G.round,
      wordsTyped: G.wordsTyped,
      bestStreak: G.bestStreak,
      bossesDefeated: G.bossesDefeated,
      flawlessBosses: G.flawlessBosses,
      clutchBosses: G.clutchBosses,
      perfectRounds: G.perfectRounds,
      powerUpsUsed: G.powerUpsUsed,
      bonusesUsed: G.bonusesUsed,
      shieldBlocks: G.shieldBlocks,
      bucketFilled: G.bucketFilled,
      fastest: G.fastest?.t ?? null,
      fastestWord: G.fastest?.w ?? null,
      typingSeconds: G.typingSeconds,
      fastestLong: G.fastestLong,
      fastestMid: G.fastestMid,
      keys: G.keys,
      goodKeys: G.goodKeys,
    };
  };

  const achievementContext = (): AchievementContext => {
    const run = runStats();
    return {
      run: run ?? emptyRun(),
      life: G.careerSaved ? lifetimeRef.current : addRun(lifetimeRef.current, run),
      dailyStreak: dailyStreakRef.current,
    };
  };

  /** Unlocks anything newly reached and queues its toast. Cheap enough to call after every event. */
  const checkAchievements = () => {
    const fresh = newlyUnlocked(achievementContext(), unlockedRef.current);
    if (!fresh.length) return;
    const today = todayKey();
    const before = unlockedRef.current;
    unlockedRef.current = { ...unlockedRef.current };
    for (const a of fresh) {
      unlockedRef.current[a.id] = today;
      if (G.phase !== "title") G.newAchievements.push(a.name);
    }
    setUnlocked(unlockedRef.current);
    saveAchievements(unlockedRef.current);
    // Achievements can unlock new themes and word packs.
    const unlockables = newUnlockables(before, unlockedRef.current);
    if (G.phase !== "title") {
      // In a game: no pop-ups to break concentration. They're listed together on the game-over screen.
      for (const u of unlockables) G.newUnlocks.push(u.kind === "theme" ? `${u.name} theme` : `${u.name} word pack`);
      return;
    }
    toastQueue.current.push(...fresh.map(a => ({ eyebrow: "ACHIEVEMENT UNLOCKED", name: a.name, desc: a.desc })));
    for (const u of unlockables) {
      toastQueue.current.push({
        eyebrow: u.kind === "theme" ? "NEW THEME UNLOCKED" : "NEW WORD PACK UNLOCKED",
        name: u.name,
        desc: "Pick it from Customize on the main menu.",
      });
    }
    if (!toastShowing.current) showNextToast();
  };

  const showNextToast = () => {
    const next = toastQueue.current.shift();
    toastShowing.current = !!next;
    setToast(next ?? null);
    if (!next) return;
    play("achieve");
    buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
    toastAnim.setValue(0);
    Animated.sequence([
      Animated.spring(toastAnim, { toValue: 1, friction: 7, tension: 90, useNativeDriver: true }),
      Animated.delay(toastQueue.current.length > 0 ? 1100 : 2200), // move faster when several are waiting
      Animated.timing(toastAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => showNextToast());
  };

  /** Adds this game's totals to the lifetime stats, once per game. */
  const saveCareer = () => {
    if (G.careerSaved) return;
    G.careerSaved = true;
    lifetimeRef.current = addRun(lifetimeRef.current, runStats());
    setLifetime(lifetimeRef.current);
    saveLifetime(lifetimeRef.current);
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
      buzz.select().catch(() => {});
    }
    // Keep the title screen's HUD in step with the pick.
    if (G.phase === "title") {
      Object.assign(G, freshState(DIFFICULTIES[id]));
      bump();
    }
  };

  const toTitle = () => {
    saveCareer();
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

  const startGame = (daily = false) => {
    if (daily && dailyRecord?.date === todayKey()) return; // one try per day
    saveCareer(); // "Play again" straight from game over
    timers.current.forEach(clearTimeout);
    timers.current = [];
    Object.assign(G, freshState(daily ? DAILY_DIFFICULTY : DIFFICULTIES[difficultyRef.current]));
    G.careerSaved = false;
    G.pack = daily ? null : PACK_BY_ID[packRef.current].words; // the Daily always uses the standard words
    if (daily) {
      const today = todayKey();
      G.daily = true;
      G.dailyDate = today;
      rng.current = dailyStreams(today);
      // Starting counts as today's try, even if the app closes mid-run.
      const record = { date: today, score: 0, round: 1, finished: false };
      setDailyRecord(record);
      saveDaily(record);
      const streak =
        dailyStreak.lastDate === today
          ? dailyStreak
          : { count: dailyStreak.lastDate === yesterdayKey() ? dailyStreak.count + 1 : 1, lastDate: today };
      setDailyStreak(streak);
      saveDailyStreak(streak);
      dailyStreakRef.current = streak.count;
    } else {
      rng.current = freeStreams();
    }
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
    G.roundMisses = 0;
    G.word = "";
    fuse.stopAnimation();
    fuse.setValue(1);
    popOverlay();
    if (G.round > 1) play("round");
    checkAchievements(); // reaching a round (and the Daily ones on the first)
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
      rng.current.words,
      G.pack,
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
    G.bossMisses = 0;
    G.bossName = pickBossName(G.bossHistory, rng.current.bosses);
    G.bossHistory.push(G.bossName);
    G.phase = "banner";
    G.word = "";
    fuse.stopAnimation();
    fuse.setValue(1);
    popOverlay();
    play("timeout");
    playMusic("boss");
    buzz.notify(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    bump();
    later(nextWord, BOSS.introMs);
  };

  const nextRound = () => {
    if (G.roundMisses === 0) G.perfectRounds++;
    G.round++;
    startRound();
  };

  const bossDefeated = () => {
    G.inBoss = false;
    G.bossesDefeated++;
    if (G.bossMisses === 0) G.flawlessBosses++;
    if (G.lives === 1 && G.d.lives > 1) G.clutchBosses++;
    const pts = BOSS.bonusPointsPerRound * G.round;
    G.score += pts;
    addFloat(`${G.bossName} defeated! +${pts}`, "reward");
    playVictory(); // stops the boss music and plays the fanfare
    buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
    checkRewards();
    checkAchievements();
    const won = rollBonus(G.bonus, rng.current.bonus);
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
      G.roundMisses++;
      G.bossMisses++;
      G.missed.add(G.pos);
      breakCombo(); // even when a Shield saves the life
      G.wrongAt = G.pos;
      letterPop.setValue(1.35);
      Animated.spring(letterPop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      play("miss");
      if (G.shields > 0) {
        G.shields--;
        G.shieldBlocks++;
        checkAchievements();
        addFloat("Shield blocked it", "reward", G.pos);
        buzz.notify(Haptics.NotificationFeedbackType.Warning).catch(() => {});
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

  /** `auto`: finished by Auto-Type, so it doesn't count as a fast word. */
  const solved = (auto = false) => {
    const used = (Date.now() - G.wordStart) / 1000;
    G.typingSeconds += Math.min(used, G.wordLimit);
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
    if (!auto) {
      if (!G.fastest || used < G.fastest.t) G.fastest = { t: used, w: G.word };
      if (G.word.length >= 7 && (G.fastestLong === null || used < G.fastestLong)) G.fastestLong = used;
      if (G.word.length >= 5 && (G.fastestMid === null || used < G.fastestMid)) G.fastestMid = used;
    }
    G.phase = "between";
    G.look = "solved";
    fuse.stopAnimation();
    const hit = G.inBoss ? (G.bossHp > 0 ? " · hit!" : " · final blow!") : "";
    const tags = [mult > 1 ? `${mult}×` : "", combo > 1 ? `combo ×${combo}` : ""].filter(Boolean).join(", ");
    addFloat(`+${pts}${tags ? ` (${tags})` : ""}${G.wordMisses === 0 && !hit && !tags ? " flawless" : ""}${hit}`, "good");
    play("word");
    buzz.impact(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    checkRewards();
    checkAchievements();
    bump();
    later(advance, 260);
  };

  const timedOut = () => {
    G.typingSeconds += G.wordLimit;
    G.phase = "between";
    G.look = "timedOut";
    G.wrongAt = null;
    G.roundMisses++;
    G.bossMisses++;
    breakCombo();
    play("timeout");
    if (G.shields > 0) {
      G.shields--;
      G.shieldBlocks++;
      checkAchievements();
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
    recordDaily();
    checkAchievements(); // end-of-game ones, like Sharpshooter
    saveCareer();
    if (G.newAchievements.length) later(() => play("achieve"), 900); // after the game-over sound
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
  /** Saves today's Daily Challenge result (it was marked as started when the run began). */
  const recordDaily = () => {
    if (!G.daily) return;
    const record = { date: G.dailyDate, score: G.score, round: G.round, finished: true };
    setDailyRecord(record);
    saveDaily(record);
  };

  const shareDaily = () => {
    const streak = dailyStreak.count > 1 ? ` (${dailyStreak.count}-day streak)` : "";
    Share.share({
      message:
        `TypeSpeedy Daily Challenge · ${prettyDate(G.dailyDate)}\n` +
        `${G.score.toLocaleString()} points · reached round ${G.round} · ${G.bossesDefeated} boss${G.bossesDefeated === 1 ? "" : "es"} beaten${streak}\n` +
        `Same words for everyone today. Can you beat it?`,
    }).catch(() => {});
  };

  const quitToMenu = () => {
    setConfirmQuit(false);
    recordBest();
    recordDaily();
    Keyboard.dismiss();
    // Quitting skips the game-over screen, so sum up this game's unlocks in one pop-up instead.
    const names = G.newAchievements;
    const extras = G.newUnlocks;
    toTitle();
    if (names.length) {
      toastQueue.current.push({
        eyebrow: names.length === 1 ? "NEW ACHIEVEMENT" : `${names.length} NEW ACHIEVEMENTS`,
        name: names.length === 1 ? names[0] : `${names[0]} +${names.length - 1} more`,
        desc: extras.length ? `Unlocked: ${extras.join(", ")}` : "See them all in Achievements.",
      });
      if (!toastShowing.current) showNextToast();
    }
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
        const id = rollPowerUp(rng.current.powerups);
        G.inventory.push(id);
        if (G.inventory.length >= REWARDS.bucketSize) G.bucketFilled = true;
        later(() => addFloat(`New power-up: ${POWERUPS[id].name}`, "reward"), 280);
        buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else {
        later(() => addFloat("Bucket full · reward lost", "bad"), 280);
      }
    }
    if (G.bucketFilled) checkAchievements();
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
        solved(true); // counts as finishing the word (a hit, in a boss fight)
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
      G.bonusesUsed++;
      checkAchievements();
      addFloat(BONUS_POWERUPS[id].name, "reward");
      buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
        G.typingSeconds += Math.min((Date.now() - G.wordStart) / 1000, G.wordLimit);
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
      checkAchievements();
      addFloat(POWERUPS[id].name, "reward");
      buzz.impact(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
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

  const chooseTheme = (t: Theme) => {
    if (!meetsRequirement(t.requires, unlockedRef.current)) return;
    setThemeId(t.id);
    saveTheme(t.id);
    buzz.select().catch(() => {});
  };

  const choosePack = (p: WordPack) => {
    if (!meetsRequirement(p.requires, unlockedRef.current)) return;
    setPackId(p.id);
    packRef.current = p.id;
    savePack(p.id);
    buzz.select().catch(() => {});
  };

  const toggleHaptics = (on: boolean) => {
    setHapticsOn(on);
    setHapticsEnabled(on);
    saveHaptics(on);
    if (on) buzz.select().catch(() => {});
  };

  const toggleEffects = (on: boolean) => {
    setEffectsOn(on);
    effectsRef.current = on;
    saveEffects(on);
  };

  const doReset = () => {
    if (confirmReset === "stats") {
      bestRef.current = { easy: 0, medium: 0, hard: 0, impossible: 0 };
      setBest(bestRef.current);
      lifetimeRef.current = EMPTY_LIFETIME;
      setLifetime(EMPTY_LIFETIME);
      resetStats();
    } else if (confirmReset === "achievements") {
      unlockedRef.current = {};
      setUnlocked({});
      setThemeId("classic");
      setPackId("classic");
      packRef.current = "classic";
      resetAchievements();
    }
    setConfirmReset(null);
    buzz.notify(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  };

  const openSettings = () => {
    setConfirmReset(null);
    setShowSettings(true);
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
    if (G.phase === "title" || (G.phase === "over" && !G.daily)) startGame();
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
            {G.daily
              ? `Daily · ${prettyDate(G.dailyDate)}`
              : `${G.d.label} · Best ${Math.max(bestHere, G.score).toLocaleString()}`}
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
          <View style={s.achHead}>
            <Text style={[s.eyebrow, { flex: 1, paddingTop: 6 }]}>A TYPING SURVIVAL GAME</Text>
            <Pressable style={s.chip} onPress={openSettings} hitSlop={10} accessibilityRole="button" accessibilityLabel="Settings">
              <Text style={s.chipText}>SETTINGS</Text>
            </Pressable>
          </View>
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
          <DailyCard
            c={c}
            record={dailyRecord?.date === todayKey() ? dailyRecord : null}
            streak={dailyStreak}
            onPlay={() => startGame(true)}
          />
          <Text style={s.label}>OR PICK A DIFFICULTY</Text>
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
          <Btn c={c} label={`Start ${G.d.label}`} onPress={() => startGame()} />
          <View style={s.btnGrid}>
            <View style={s.btnHalf}>
              <Btn c={c} label="How to play" onPress={() => setShowHelp(true)} secondary />
            </View>
            <View style={s.btnHalf}>
              <Btn c={c} label="Stats" onPress={() => setShowStats(true)} secondary />
            </View>
            <View style={s.btnHalf}>
              <Btn
                c={c}
                label={`Achievements ${Object.keys(unlocked).length}/${ACHIEVEMENTS.length}`}
                onPress={() => setShowAchievements(true)}
                secondary
              />
            </View>
            <View style={s.btnHalf}>
              <Btn c={c} label="Customize" onPress={() => setShowCustomize(true)} secondary />
            </View>
          </View>
        </Overlay>
      )}

      {G.phase === "title" && showStats && (
        <Overlay c={c} pop={overlayPop}>
          <View style={s.achHead}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.eyebrow}>STATS</Text>
              <Text style={s.h2}>Your career</Text>
            </View>
            <Pressable style={s.chip} onPress={() => setShowStats(false)} hitSlop={10} accessibilityRole="button">
              <Text style={s.chipText}>CLOSE</Text>
            </Pressable>
          </View>
          {lifetime.games === 0 ? (
            <Text style={s.body}>Play a game and your totals and records will show up here.</Text>
          ) : (
            <StatsBody c={c} life={lifetime} best={best} streak={dailyStreak} unlockedCount={Object.keys(unlocked).length} />
          )}
          <Btn c={c} label="Done" onPress={() => setShowStats(false)} />
        </Overlay>
      )}

      {G.phase === "title" && showCustomize && (
        <Overlay c={c} pop={overlayPop}>
          <View style={s.achHead}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.eyebrow}>CUSTOMIZE</Text>
              <Text style={s.h2}>Make it yours</Text>
            </View>
            <Pressable style={s.chip} onPress={() => setShowCustomize(false)} hitSlop={10} accessibilityRole="button">
              <Text style={s.chipText}>CLOSE</Text>
            </Pressable>
          </View>
          <Text style={s.body}>Earn achievements to unlock new color themes and word packs.</Text>
          <Text style={s.label}>COLOR THEME</Text>
          <View style={s.diffGrid} accessibilityRole="radiogroup">
            {THEMES.map(t => (
              <ThemeCard
                key={t.id}
                c={c}
                t={t}
                preview={themePalette(t.id, systemDark).c}
                open={meetsRequirement(t.requires, unlocked)}
                selected={themeId === t.id}
                onPress={() => chooseTheme(t)}
              />
            ))}
          </View>
          <Text style={[s.label, { marginTop: 6 }]}>WORD PACK</Text>
          <View style={{ gap: 8 }} accessibilityRole="radiogroup">
            {WORD_PACKS.map(p => (
              <PackRow
                key={p.id}
                c={c}
                p={p}
                open={meetsRequirement(p.requires, unlocked)}
                selected={packId === p.id}
                onPress={() => choosePack(p)}
              />
            ))}
          </View>
          <Text style={s.slotEffect}>Word packs apply to normal games. The Daily Challenge always uses the standard words so everyone gets the same ones.</Text>
          <Btn c={c} label="Done" onPress={() => setShowCustomize(false)} />
        </Overlay>
      )}

      {G.phase === "title" && showAchievements && (
        <Overlay c={c} pop={overlayPop}>
          <View style={s.achHead}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.eyebrow, { color: c.gold }]}>ACHIEVEMENTS</Text>
              <Text style={s.h2}>
                {Object.keys(unlocked).length} of {ACHIEVEMENTS.length}
              </Text>
            </View>
            <Pressable style={s.chip} onPress={() => setShowAchievements(false)} hitSlop={10} accessibilityRole="button">
              <Text style={s.chipText}>CLOSE</Text>
            </Pressable>
          </View>
          <View style={s.fuseTrack}>
            <View
              style={[
                s.fuseFill,
                { backgroundColor: c.gold, transform: [{ scaleX: Object.keys(unlocked).length / ACHIEVEMENTS.length }] },
              ]}
            />
          </View>
          {ACHIEVEMENT_GROUPS.map(group => (
            <View key={group} style={{ gap: 8 }}>
              <Text style={[s.label, { marginTop: 6 }]}>{group.toUpperCase()}</Text>
              {ACHIEVEMENTS.filter(a => a.group === group).map(a => (
                <AchievementRow
                  key={a.id}
                  c={c}
                  a={a}
                  date={unlocked[a.id]}
                  ctx={{ run: emptyRun(), life: lifetime, dailyStreak: dailyStreak.count }}
                />
              ))}
            </View>
          ))}
          <Btn c={c} label="Done" onPress={() => setShowAchievements(false)} />
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

      {(G.phase === "title" || G.phase === "paused") && showSettings && (
        <Overlay c={c} pop={overlayPop}>
          <View style={s.achHead}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.eyebrow}>PREFERENCES</Text>
              <Text style={s.h2}>Settings</Text>
            </View>
            <Pressable style={s.chip} onPress={() => setShowSettings(false)} hitSlop={10} accessibilityRole="button">
              <Text style={s.chipText}>CLOSE</Text>
            </Pressable>
          </View>

          <Text style={s.label}>SOUND</Text>
          <View style={s.setGroup}>
            <SettingRow c={c} label="Sound effects" detail="Key clicks, misses and fanfares" value={!muted} onChange={toggleMute} />
            <SettingRow c={c} label="Music" detail="Retro background music" value={musicOn} onChange={toggleMusic} last />
          </View>

          <Text style={s.label}>FEEL</Text>
          <View style={s.setGroup}>
            <SettingRow
              c={c}
              label="Vibration"
              detail="Buzz on misses, finished words and rewards"
              value={hapticsOn}
              onChange={toggleHaptics}
            />
            <SettingRow
              c={c}
              label="Screen shake & flash"
              detail="Shake and red flash on a miss. The letter still turns red when off."
              value={effectsOn}
              onChange={toggleEffects}
              last
            />
          </View>

          {G.phase === "title" && (
            <>
              <Text style={s.label}>LOOK & WORDS</Text>
              <Btn
                c={c}
                label="Themes and word packs"
                onPress={() => {
                  setShowSettings(false);
                  setShowCustomize(true);
                }}
                secondary
              />

              <Text style={s.label}>RESET</Text>
              {confirmReset ? (
                <View style={s.achNew}>
                  <Text style={[s.ruleText, { fontFamily: fonts.bodyStrong }]}>
                    {confirmReset === "stats"
                      ? "Erase your best scores and career stats? This can’t be undone."
                      : "Lock every achievement again? Themes and word packs they unlocked go back to Classic. This can’t be undone."}
                  </Text>
                  <Btn c={c} label={confirmReset === "stats" ? "Yes, reset stats" : "Yes, reset achievements"} onPress={doReset} danger />
                  <Btn c={c} label="Cancel" onPress={() => setConfirmReset(null)} secondary />
                </View>
              ) : (
                <View style={s.btnGrid}>
                  <View style={s.btnHalf}>
                    <Btn c={c} label="Reset stats" onPress={() => setConfirmReset("stats")} secondary />
                  </View>
                  <View style={s.btnHalf}>
                    <Btn c={c} label="Reset achievements" onPress={() => setConfirmReset("achievements")} secondary />
                  </View>
                </View>
              )}
            </>
          )}

          <Text style={s.slotEffect}>
            TypeSpeedy {APP_VERSION} · Music and sounds are original, made for this game · Fonts: Bricolage Grotesque, IBM Plex
            Mono and Inter (SIL Open Font License)
          </Text>
          <Btn c={c} label="Done" onPress={() => setShowSettings(false)} />
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
              <Btn c={c} label="Settings" onPress={openSettings} secondary />
              <Btn c={c} label="Quit to main menu" onPress={() => setConfirmQuit(true)} secondary />
            </>
          )}
        </Overlay>
      )}

      {G.phase === "over" && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={[s.eyebrow, { color: G.daily ? c.gold : c.miss }]}>
            {G.daily ? `DAILY CHALLENGE · ${prettyDate(G.dailyDate).toUpperCase()}` : `${G.d.label.toUpperCase()} · `}
            {G.daily ? "" : oneLife ? "GAME OVER" : "OUT OF LIVES"}
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
          {G.newAchievements.length > 0 && (
            <View style={s.achNew}>
              <Text style={[s.label, { color: c.gold }]}>
                {G.newAchievements.length === 1 ? "NEW ACHIEVEMENT" : `${G.newAchievements.length} NEW ACHIEVEMENTS`}
              </Text>
              <Text style={s.ruleText}>{G.newAchievements.join(" · ")}</Text>
              {G.newUnlocks.length > 0 && (
                <Text style={[s.ruleText, { color: c.gold, fontFamily: fonts.bodyStrong }]}>
                  Unlocked: {G.newUnlocks.join(" · ")}
                </Text>
              )}
            </View>
          )}
          {G.daily ? (
            <>
              <Text style={[s.body, { color: c.ink }]}>
                That was today’s try. A new challenge unlocks in {timeUntilTomorrow()}.
                {dailyStreak.count > 1 ? ` You're on a ${dailyStreak.count}-day streak.` : ""}
              </Text>
              <Btn c={c} label="Share result" onPress={shareDaily} />
              <Btn c={c} label="Main menu" onPress={toTitle} secondary />
            </>
          ) : (
            <>
              <Btn c={c} label="Play again" onPress={() => startGame()} />
              <Btn c={c} label="Main menu" onPress={toTitle} secondary />
            </>
          )}
        </Overlay>
      )}

      {/* "Achievement unlocked" toast: over everything, never blocks taps */}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            s.toast,
            {
              top: insets.top + 6,
              opacity: toastAnim,
              transform: [{ translateY: toastAnim.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) }],
            },
          ]}
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${toast.eyebrow.toLowerCase()}: ${toast.name}. ${toast.desc}`}
        >
          <Text style={[s.label, { color: c.gold }]}>{toast.eyebrow}</Text>
          <Text style={s.toastName} numberOfLines={1}>
            {toast.name}
          </Text>
          <Text style={s.slotEffect} numberOfLines={2}>
            {toast.desc}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

/** "45s", "12m", "3h 12m" */
function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** The Stats screen: lifetime totals and records, in small groups. */
function StatsBody({
  c,
  life,
  best,
  streak,
  unlockedCount,
}: {
  c: Palette;
  life: LifetimeStats;
  best: BestScores;
  streak: DailyStreak;
  unlockedCount: number;
}) {
  const s = styles(c);
  const n = (v: number) => v.toLocaleString();
  const accuracy = life.keys ? `${((life.goodKeys / life.keys) * 100).toFixed(1)}%` : "–";
  const streakNow = streak.lastDate === todayKey() || streak.lastDate === yesterdayKey() ? streak.count : 0;
  const plural = (v: number, word: string) => `${n(v)} ${word}${v === 1 ? "" : "s"}`;
  const section = (title: string, items: [string, string, string?][]) => (
    <View style={{ gap: 10 }}>
      <Text style={[s.label, { color: c.accent }]}>{title}</Text>
      <View style={s.results}>
        {items.map(([k, v, note]) => (
          <Result key={k} c={c} k={k} v={v} note={note} />
        ))}
      </View>
    </View>
  );
  return (
    <View style={{ gap: 18 }}>
      {section("OVERVIEW", [
        ["GAMES PLAYED", n(life.games)],
        ["TIME TYPING", formatDuration(life.typingSeconds)],
        ["WORDS TYPED", n(life.words)],
        ["POINTS SCORED", n(life.points)],
      ])}
      {section("RECORDS", [
        ["HIGHEST ROUND", life.bestRound ? n(life.bestRound) : "–"],
        ["LONGEST STREAK", life.bestStreak ? n(life.bestStreak) : "–", life.bestStreak ? "flawless words" : undefined],
        ["FASTEST WORD", life.fastest ? `${life.fastest.t.toFixed(2)}s` : "–", life.fastest ? `“${life.fastest.w}”` : undefined],
        ["AVERAGE SCORE", life.games ? n(Math.round(life.points / life.games)) : "–"],
      ])}
      {section(
        "BEST SCORES",
        DIFFICULTY_ORDER.map(id => [
          DIFFICULTIES[id].label.toUpperCase(),
          best[id] ? n(best[id]) : "–",
          life.gamesByDifficulty[id] ? plural(life.gamesByDifficulty[id], "game") : undefined,
        ]),
      )}
      {section("ACCURACY", [
        ["ACCURACY", accuracy],
        ["LETTERS TYPED", n(life.keys)],
      ])}
      {section("BOSSES & ROUNDS", [
        ["BOSSES BEATEN", n(life.bosses)],
        ["FLAWLESS BOSSES", n(life.flawlessBosses)],
        ["PERFECT ROUNDS", n(life.perfectRounds)],
        ["POWER-UPS USED", n(life.powerUps)],
      ])}
      {section("DAILY & MORE", [
        ["DAILIES PLAYED", n(life.dailies)],
        ["DAY STREAK", streakNow ? plural(streakNow, "day") : "–"],
        ["ACHIEVEMENTS", `${unlockedCount} of ${ACHIEVEMENTS.length}`],
      ])}
    </View>
  );
}

/** Customize: a color theme, drawn in its own colors. */
function ThemeCard({
  c,
  t,
  preview: p,
  open,
  selected,
  onPress,
}: {
  c: Palette;
  t: Theme;
  preview: Palette;
  open: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const s = styles(c);
  return (
    <Pressable
      onPress={onPress}
      disabled={!open}
      style={[s.diffCard, { gap: 6 }, selected && { borderColor: c.accent, backgroundColor: c.accentSoft }]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !open }}
      accessibilityLabel={`${t.name} theme${open ? "" : `, locked. ${requirementText(t.requires)}`}`}
    >
      <View style={[s.themeSwatch, { backgroundColor: p.bg, borderColor: p.line, opacity: open ? 1 : 0.45 }]}>
        <Text style={[s.themeWord, { color: p.ink }]} allowFontScaling={false}>
          ty<Text style={{ color: p.miss }}>p</Text>
          <Text style={{ color: p.ghost }}>e</Text>
        </Text>
        <View style={s.themeDots}>
          {[p.accent, p.good, p.gold].map((col, i) => (
            <View key={i} style={[s.themeDot, { backgroundColor: col }]} />
          ))}
        </View>
      </View>
      <Text style={[s.slotName, { color: selected ? c.accent : open ? c.ink : c.muted }]}>
        {open ? "" : "🔒 "}
        {t.name}
      </Text>
      {open ? (
        <Text style={s.slotEffect}>{t.palette ? (selected ? "In use" : "Unlocked") : "Follows your phone"}</Text>
      ) : (
        <Text style={s.slotEffect}>{requirementText(t.requires)}</Text>
      )}
    </Pressable>
  );
}

/** Customize: a word pack, with a few of its words. */
function PackRow({
  c,
  p,
  open,
  selected,
  onPress,
}: {
  c: Palette;
  p: WordPack;
  open: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const s = styles(c);
  const sample = p.words ? [p.words[30], p.words[60], p.words[100] ?? p.words[90]].filter(Boolean).join(" · ") : "";
  return (
    <Pressable
      onPress={onPress}
      disabled={!open}
      style={[s.achRow, selected && { borderColor: c.accent, backgroundColor: c.accentSoft }, !open && { opacity: 0.75 }]}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !open }}
      accessibilityLabel={`${p.name} word pack${open ? "" : `, locked. ${requirementText(p.requires)}`}`}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.slotName, { color: selected ? c.accent : open ? c.ink : c.muted }]}>
          {open ? "" : "🔒 "}
          {p.name}
          {p.words && open ? <Text style={s.achCount}>{`  ${p.words.length} words`}</Text> : null}
        </Text>
        <Text style={s.slotEffect}>{open ? `${p.desc}${sample ? ` ${sample}` : ""}` : requirementText(p.requires)}</Text>
      </View>
      {selected && <Text style={s.achDate}>IN USE</Text>}
    </Pressable>
  );
}

/** One line of the achievements list: unlocked (gold, with the date) or locked (with progress). */
function AchievementRow({
  c,
  a,
  date,
  ctx,
}: {
  c: Palette;
  a: Achievement;
  date: string | undefined;
  ctx: AchievementContext;
}) {
  const s = styles(c);
  const done = !!date;
  const [cur, target] = a.progress(ctx);
  const showBar = !done && a.showProgress && cur > 0;
  return (
    <View
      style={[s.achRow, done && { borderColor: c.gold, backgroundColor: c.surface }]}
      accessibilityLabel={`${a.name}: ${a.desc} ${done ? "Unlocked" : "Locked"}`}
    >
      <View style={[s.achMark, { borderColor: done ? c.gold : c.line, backgroundColor: done ? c.gold : "transparent" }]}>
        <Text style={[s.achMarkText, { color: done ? c.onAccent : c.ghost }]}>{done ? "✓" : ""}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.slotName, { color: done ? c.ink : c.muted }]}>{a.name}</Text>
        <Text style={s.slotEffect}>{a.desc}</Text>
        {showBar && (
          <View style={s.achBarRow}>
            <View style={[s.fuseTrack, { flex: 1, height: 6 }]}>
              <View style={[s.fuseFill, { backgroundColor: c.gold, transform: [{ scaleX: cur / target }] }]} />
            </View>
            <Text style={s.achCount}>
              {cur.toLocaleString()} / {target.toLocaleString()}
            </Text>
          </View>
        )}
      </View>
      {done && <Text style={s.achDate}>{prettyDate(date)}</Text>}
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
/** Start screen: today's Daily Challenge, or today's result once it's been played. */
function DailyCard({
  c,
  record,
  streak,
  onPlay,
}: {
  c: Palette;
  record: DailyRecord | null; // today's attempt, if any
  streak: DailyStreak;
  onPlay: () => void;
}) {
  const s = styles(c);
  const today = todayKey();
  const streakText =
    streak.count > 0 && (streak.lastDate === today || streak.lastDate === yesterdayKey())
      ? ` · ${streak.count}-day streak`
      : "";
  if (record) {
    return (
      <View style={[s.dailyCard, s.dailyDone]} accessibilityLabel="Today's Daily Challenge is done">
        <Text style={[s.label, { color: c.gold }]}>DAILY CHALLENGE · {prettyDate(today).toUpperCase()}</Text>
        <Text style={s.dailyTitle}>
          {record.finished ? `${record.score.toLocaleString()} points · round ${record.round}` : "Today's try is used up"}
        </Text>
        <Text style={s.slotEffect}>
          Next challenge in {timeUntilTomorrow()}
          {streakText}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPlay}
      style={({ pressed }) => [s.dailyCard, pressed && { transform: [{ scale: 0.98 }] }]}
      accessibilityRole="button"
      accessibilityLabel="Play today's Daily Challenge"
    >
      <Text style={[s.label, { color: c.gold }]}>DAILY CHALLENGE · {prettyDate(today).toUpperCase()}</Text>
      <Text style={s.dailyTitle}>Play today’s challenge</Text>
      <Text style={s.slotEffect}>
        Same words for everyone today · Medium rules · one try{streakText}
      </Text>
    </Pressable>
  );
}

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

/** A labeled on/off switch in the Settings screen. */
function SettingRow({
  c,
  label,
  detail,
  value,
  onChange,
  last,
}: {
  c: Palette;
  label: string;
  detail: string;
  value: boolean;
  onChange: (on: boolean) => void;
  last?: boolean;
}) {
  const s = styles(c);
  return (
    <View style={[s.setRow, !last && { borderBottomWidth: 1, borderBottomColor: c.line }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.slotName, { color: c.ink }]}>{label}</Text>
        <Text style={s.slotEffect}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: c.line, true: c.accent }}
        thumbColor={Platform.OS === "android" ? (value ? c.onAccent : c.muted) : undefined}
        ios_backgroundColor={c.line}
        accessibilityLabel={label}
      />
    </View>
  );
}

function Btn({
  c,
  label,
  onPress,
  secondary,
  danger,
}: {
  c: Palette;
  label: string;
  onPress: () => void;
  secondary?: boolean;
  danger?: boolean;
}) {
  const s = styles(c);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        s.btn,
        secondary && s.btnSecondary,
        danger && { backgroundColor: c.miss },
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
    dailyCard: {
      borderWidth: 1.5,
      borderColor: c.gold,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      gap: 3,
      backgroundColor: c.surface,
    },
    dailyDone: { borderStyle: "dashed", backgroundColor: "transparent" },
    dailyTitle: { fontFamily: fonts.display, fontSize: 19, color: c.ink },
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

    setGroup: { borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 12, marginTop: -6 },
    setRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
    btnGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
    btnHalf: { width: "48.5%" },
    themeSwatch: {
      borderWidth: 1,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    themeWord: { fontFamily: fonts.word, fontSize: 20 },
    themeDots: { flexDirection: "row", gap: 4 },
    themeDot: { width: 9, height: 9, borderRadius: 5 },
    achHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    achRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1,
      borderColor: c.line,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    achMark: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
    achMarkText: { fontFamily: fonts.bodyStrong, fontSize: 13, lineHeight: 16 },
    achBarRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 3 },
    achCount: { fontFamily: fonts.bodyStrong, fontSize: 11, color: c.muted, fontVariant: ["tabular-nums"] },
    achDate: { fontFamily: fonts.bodyStrong, fontSize: 11, color: c.gold },
    achNew: { borderWidth: 1.5, borderColor: c.gold, borderRadius: 12, padding: 10, gap: 3 },
    toast: {
      position: "absolute",
      left: 18,
      right: 18,
      alignSelf: "center",
      maxWidth: 480,
      borderWidth: 1.5,
      borderColor: c.gold,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 10,
      backgroundColor: c.surface,
      gap: 2,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
    },
    toastName: { fontFamily: fonts.display, fontSize: 20, color: c.ink },
    bannerWrap: { alignItems: "center", justifyContent: "center", backgroundColor: c.scrim },
    banner: { alignItems: "center", gap: 6 },
    bannerBig: { fontFamily: fonts.display, fontSize: 110, lineHeight: 112, color: c.ink, letterSpacing: -3 },
    bannerSub: { fontFamily: fonts.body, fontSize: 15, color: c.muted },
    bannerNote: { fontFamily: fonts.bodyStrong, fontSize: 14, color: c.accent },
  });
}
