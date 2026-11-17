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
import { EMPTY_TRIALS, PRO, isProMode, spendTrial, trialsLeft, type ProTrials } from "./pro";
import { PURCHASES_TEST_MODE, buyPro, getProPrice, restorePro } from "./purchases";
import {
  EMPTY_TOWER,
  PHOENIX,
  TOWER,
  isCheckpointFloor,
  nextCheckpoint,
  towerTier,
  type TowerProgress,
} from "./tower";
import {
  EMPTY_MIX,
  MIX,
  MIX_TWISTS,
  pickTwist,
  type MixBest,
  type MixTwistId,
  EMPTY_RUSH,
  EMPTY_SPRINT,
  EMPTY_ZEN,
  MODES,
  MODE_BY_ID,
  RUSH,
  SPRINT,
  SUDDEN,
  ZEN,
  wpm,
  type GameMode,
  type RushBest,
  type SprintBest,
  type ZenBest,
} from "./modes";

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
  loadSprint,
  loadZen,
  loadRush,
  loadSudden,
  loadMix,
  loadPro,
  loadTower,
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
  saveMode,
  saveSprint,
  saveZen,
  saveRush,
  saveSudden,
  saveMix,
  savePro,
  saveTrials,
  saveTower,
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
  bossArmor: number; // words to break one health block (2 for the Typo Tyrant, else 1)
  bossChip: number; // words landed on the current block so far
  bossRegen: boolean; // the boss heals a block when a word times out (the Typo Tyrant)
  newAchievements: string[]; // names unlocked this game, for the game-over screen
  newUnlocks: string[]; // themes and word packs unlocked this game
  pack: string[] | null; // this game's word pack (null = the standard list)
  mode: GameMode; // in Tower Climb, `round` is the floor
  startFloor: number;
  floorCleared: number; // highest floor cleared this climb
  towerTop: boolean; // cleared floor 100 this climb
  phoenix: boolean; // Phoenix Feather ready (Survival, after topping the Tower)
  // Sprint: one clock for the whole game (wordStart/wordLimit), so words are timed from wordShownAt
  clockStarted: boolean;
  wordShownAt: number;
  pausedAt: number;
  lettersTyped: number; // letters in finished words, for words per minute
  // Marathon Mix
  twist: MixTwistId | null; // this round's twist
  twistHistory: MixTwistId[];
  twistCardId: number; // bumps when the twist card closes, so its timer can't start the round twice
  giantBosses: number;
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
    bossArmor: 1,
    bossChip: 0,
    bossRegen: false,
    newAchievements: [],
    newUnlocks: [],
    pack: null,
    mode: "classic",
    startFloor: 1,
    floorCleared: 0,
    towerTop: false,
    phoenix: false,
    clockStarted: false,
    wordShownAt: 0,
    pausedAt: 0,
    lettersTyped: 0,
    twist: null,
    twistHistory: [],
    twistCardId: 0,
    giantBosses: 0,
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
  const [mode, setModeState] = useState<GameMode>("classic");
  const modeRef = useRef<GameMode>("classic");
  const [tower, setTower] = useState<TowerProgress>(EMPTY_TOWER);
  const towerRef = useRef<TowerProgress>(EMPTY_TOWER);
  const [sprintBest, setSprintBest] = useState<SprintBest>(EMPTY_SPRINT);
  const sprintBestRef = useRef<SprintBest>(EMPTY_SPRINT);
  const [showModes, setShowModes] = useState(false);
  const [zenBest, setZenBest] = useState<ZenBest>(EMPTY_ZEN);
  const zenBestRef = useRef<ZenBest>(EMPTY_ZEN);
  const [rushBest, setRushBest] = useState<RushBest>(EMPTY_RUSH);
  const rushBestRef = useRef<RushBest>(EMPTY_RUSH);
  const [suddenBest, setSuddenBest] = useState<BestScores>({ easy: 0, medium: 0, hard: 0, impossible: 0 });
  const suddenBestRef = useRef<BestScores>(suddenBest);
  const [mixBest, setMixBest] = useState<MixBest>(EMPTY_MIX);
  const mixBestRef = useRef<MixBest>(EMPTY_MIX);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmReset, setConfirmReset] = useState<"stats" | "achievements" | null>(null);
  const [hapticsOn, setHapticsOn] = useState(true);
  const [effectsOn, setEffectsOn] = useState(true);
  const effectsRef = useRef(true); // read by hitEffects(), which can run from an old render's timer
  const [pro, setPro] = useState(false);
  const proRef = useRef(false);
  const [trials, setTrials] = useState<ProTrials>(EMPTY_TRIALS);
  const trialsRef = useRef<ProTrials>(EMPTY_TRIALS);
  const [showPaywall, setShowPaywall] = useState(false);
  const [paywallMsg, setPaywallMsg] = useState("");
  const [paywallBusy, setPaywallBusy] = useState(false);
  const [proPrice, setProPrice] = useState(PRO.fallbackPrice);
  // Themes other than Classic need Pro to use (they still unlock through achievements).
  const { c: baseColors, dark: isDark } = themePalette(pro ? themeId : "classic", systemDark);
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
  const twistTimer = useRef(new Animated.Value(1)).current; // Marathon Mix: the twist card's countdown bar
  const pips = useRef(Array.from({ length: MAX_LIVES }, () => new Animated.Value(1))).current;

  /* ---------- setup ---------- */
  useEffect(() => {
    initSounds();
    loadPro().then(p => {
      proRef.current = p.pro;
      setPro(p.pro);
      trialsRef.current = p.trials;
      setTrials(p.trials);
    });
    getProPrice().then(price => price && setProPrice(price));
    loadMix().then(b => {
      mixBestRef.current = b;
      setMixBest(b);
    });
    loadSudden().then(b => {
      suddenBestRef.current = b;
      setSuddenBest(b);
    });
    loadRush().then(b => {
      rushBestRef.current = b;
      setRushBest(b);
    });
    loadZen().then(b => {
      zenBestRef.current = b;
      setZenBest(b);
    });
    loadSprint().then(b => {
      sprintBestRef.current = b;
      setSprintBest(b);
    });
    loadTower().then(t => {
      towerRef.current = t;
      setTower(t);
    });
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
      setModeState(p.mode);
      modeRef.current = p.mode;
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
      mode: G.mode,
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
      startFloor: G.startFloor,
      floorCleared: G.floorCleared,
      towerTop: G.towerTop,
      giantBosses: G.giantBosses,
      twistsSeen: new Set(G.twistHistory.filter(t => t !== "warmup")).size,
      wpm: G.mode === "sprint" ? wpm(G.lettersTyped, sprintSeconds()) : G.mode === "zen" ? zenWpm() : 0,
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
      if (!finished) return;
      if (G.mode === "sprint") {
        if (G.phase !== "over" && G.phase !== "paused" && G.phase !== "title") gameOver(); // time's up
        return;
      }
      if (G.wordId === id && G.phase === "playing") timedOut();
    });
  };

  /* ---------- modes ---------- */
  const inTower = () => G.mode === "tower";
  const inSprint = () => G.mode === "sprint";
  const inZen = () => G.mode === "zen";
  const inRush = () => G.mode === "rush";
  const inSudden = () => G.mode === "sudden";
  const inMix = () => G.mode === "mix";
  /** Marathon Mix: this round's twist (null in other modes). */
  const twist = () => (inMix() && G.twist ? MIX_TWISTS[G.twist] : null);
  /** Zen: time spent on words (pauses don't count), including the word on screen now. */
  const zenSeconds = () => G.typingSeconds + (G.phase === "playing" ? (Date.now() - G.wordShownAt) / 1000 : 0);
  const zenWpm = () => wpm(G.lettersTyped, zenSeconds());

  /** Zen: the Finish button ends the session and shows the summary. */
  const finishZen = () => {
    if (!inZen() || G.phase === "over" || G.phase === "title") return;
    if (G.phase === "paused") G.phase = "between";
    gameOver();
  };
  /** The Survival round that sets the clock and word lengths (a Tower floor maps onto one). */
  const tier = () => (inTower() ? towerTier(G.round) : G.round);
  const maxLives = () => (inTower() ? TOWER.maxLives : inRush() ? RUSH.maxLives : inSudden() ? 1 : MAX_LIVES);

  const chooseMode = (m: GameMode) => {
    modeRef.current = m;
    setModeState(m);
    saveMode(m);
    setShowModes(false);
    buzz.select().catch(() => {});
  };

  /** Sprint: a wrong letter takes time off the clock. */
  const sprintPenalty = () => {
    const left = remainingSeconds() - SPRINT.missPenalty;
    addFloat(`−${SPRINT.missPenalty}s`, "bad", G.pos);
    hitEffects();
    if (left <= 0) {
      fuse.stopAnimation();
      fuse.setValue(0);
      G.phase = "between";
      later(gameOver, 400);
    } else setClock(left);
  };

  const updateTower = (t: TowerProgress) => {
    towerRef.current = t;
    setTower(t);
    saveTower(t);
  };

  /** Phoenix Feather: on losing the last life, come back once. Returns true if it saved the game. */
  const tryPhoenix = () => {
    if (!G.phoenix || G.lives > 0) return false;
    G.phoenix = false;
    G.lives = PHOENIX.lives;
    for (let i = 0; i < G.lives; i++) {
      pips[i].setValue(1.8);
      Animated.spring(pips[i], { toValue: 1, friction: 4, useNativeDriver: true }).start();
    }
    later(() => addFloat(`Phoenix Feather! Back with ${PHOENIX.lives} lives`, "reward"), 200);
    play("round");
    buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return true;
  };

  /** Clearing floor 100: the climb is won. */
  const towerComplete = () => {
    G.towerTop = true;
    G.floorCleared = TOWER.floors;
    updateTower({ ...towerRef.current, checkpoint: 0, best: TOWER.floors, cleared: true });
    checkAchievements();
    gameOver();
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
    // Pro modes: free players get one try per mode per day.
    if (!daily && isProMode(modeRef.current) && !proRef.current) {
      const today = todayKey();
      if (trialsLeft(trialsRef.current, modeRef.current, today) <= 0) {
        if (G.phase === "over") toTitle();
        openPaywall();
        return;
      }
      trialsRef.current = spendTrial(trialsRef.current, modeRef.current, today);
      setTrials(trialsRef.current);
      saveTrials(trialsRef.current);
    }
    saveCareer(); // "Play again" straight from game over
    timers.current.forEach(clearTimeout);
    timers.current = [];
    const climbing = !daily && modeRef.current === "tower";
    const sprinting = !daily && modeRef.current === "sprint";
    const zenning = !daily && modeRef.current === "zen";
    const rushing = !daily && modeRef.current === "rush";
    const suddenDeath = !daily && modeRef.current === "sudden";
    const mixing = !daily && modeRef.current === "mix";
    Object.assign(
      G,
      freshState(
        daily
          ? DAILY_DIFFICULTY
          : climbing
            ? TOWER.difficulty
            : sprinting
              ? SPRINT.difficulty
              : zenning
                ? ZEN.difficulty
                : rushing
                  ? RUSH.difficulty
                  : mixing
                    ? MIX.difficulty
                    : DIFFICULTIES[difficultyRef.current],
      ),
    );
    G.careerSaved = false;
    if (sprinting) {
      G.mode = "sprint";
    } else if (zenning) {
      G.mode = "zen";
    } else if (rushing) {
      G.mode = "rush";
      G.lives = RUSH.lives;
    } else if (mixing) {
      G.mode = "mix";
    } else if (suddenDeath) {
      G.mode = "sudden"; // the chosen difficulty, but only one life (and no Phoenix Feather)
      G.lives = 1;
    } else if (climbing) {
      G.mode = "tower";
      G.lives = TOWER.lives;
      G.round = towerRef.current.checkpoint + 1; // start at the last checkpoint
      G.startFloor = G.round;
      updateTower({ ...towerRef.current, climbs: towerRef.current.climbs + 1 });
    } else if (!daily && towerRef.current.cleared) {
      G.phoenix = true; // the Tower reward (not in the Daily, so everyone plays it the same)
    }
    // The Daily always uses the standard words; other packs need Pro.
    G.pack = daily || !proRef.current ? null : PACK_BY_ID[packRef.current].words;
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
    if (inMix()) {
      G.twist = G.round === 1 ? "warmup" : pickTwist(G.twistHistory, rng.current.bosses);
      G.twistHistory.push(G.twist);
      const free = MIX_TWISTS[G.twist].startShields ?? 0;
      if (free) G.shields += free;
    }
    G.limit = inSprint() ? SPRINT.seconds : timeForRound(tier(), G.d) * (twist()?.timeFactor ?? 1);
    if (inSprint()) G.wordLimit = SPRINT.seconds;
    if (inZen()) G.limit = G.wordLimit = Infinity; // no clock
    if (inRush()) {
      // No normal words: straight into the next boss.
      G.wordInRound = 0;
      G.roundMisses = 0;
      checkAchievements();
      return startBoss();
    }
    G.wordInRound = 0;
    G.roundMisses = 0;
    G.word = "";
    fuse.stopAnimation();
    fuse.setValue(1);
    popOverlay();
    if (G.round > G.startFloor) play("round");
    if (inTower() && G.round > towerRef.current.best) updateTower({ ...towerRef.current, best: G.round });
    checkAchievements(); // reaching a round (and the Daily ones on the first)
    playMusic("main"); // keeps going if it's already on; restarts after a boss
    bump();
    if (inMix()) {
      // Marathon Mix: a card explains the round's twist. It closes on its own, or on a tap.
      const id = G.twistCardId;
      twistTimer.setValue(1);
      Animated.timing(twistTimer, { toValue: 0, duration: MIX.cardMs, easing: Easing.linear, useNativeDriver: true }).start();
      later(() => closeTwistCard(id), MIX.cardMs);
      return;
    }
    later(nextWord, inTower() && !isCheckpointFloor(G.round) ? TOWER.bannerMs : inZen() ? 1400 : 1700);
  };

  /** This word's clock: the round's, shortened word by word under Shrinking Clock. */
  const wordClock = () => {
    const shrink = twist()?.shrinkPerWord;
    return shrink ? G.limit * Math.max(0.4, 1 - shrink * G.wordInRound) : G.limit;
  };

  /** A random power-up into the bucket (if there's room). Returns whether it fit. */
  const givePowerUp = (why: string) => {
    if (G.inventory.length >= REWARDS.bucketSize) return false;
    const id = rollPowerUp(rng.current.powerups, inSudden() ? ["life"] : []); // no extra lives in Sudden Death
    G.inventory.push(id);
    if (G.inventory.length >= REWARDS.bucketSize) G.bucketFilled = true;
    later(() => addFloat(`${why}: ${POWERUPS[id].name}`, "reward"), 280);
    buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
    return true;
  };

  /** Marathon Mix: close the twist card and start the round (once, whether by tap or timer). */
  const closeTwistCard = (id = G.twistCardId) => {
    if (!inMix() || id !== G.twistCardId || G.phase !== "banner" || G.inBoss) return;
    G.twistCardId++;
    twistTimer.stopAnimation();
    focusInput();
    nextWord();
  };

  const nextWord = () => {
    const range = inSprint()
      ? SPRINT.lengths
      : inZen()
        ? ZEN.lengths
        : (twist()?.lengths ?? G.d.lengths(tier()));
    G.word = pickWord(
      G.inBoss ? bossRange(range) : range,
      G.recent,
      maxLettersAt(sizing.current.stageWidth, sizing.current.glyphPerPx),
      rng.current.words,
      G.pack,
    );
    G.recent.push(G.word);
    if (G.recent.length > 40) G.recent.shift();
    if (twist()?.backwards) G.word = [...G.word].reverse().join("");
    if (twist()?.scramble) G.word = scrambleWord(G.word, rng.current.words);
    if (twist()?.vanish) {
      const id = G.wordId + 1; // this word's id (bumped just below)
      later(() => {
        if (G.wordId === id) bump(); // redraw so the letters hide
      }, MIX.vanishMs);
    }
    G.pos = 0;
    G.wordMisses = 0;
    G.missed = new Set();
    G.wrongAt = null;
    G.look = "normal";
    G.wordId++;
    G.wordShownAt = Date.now();
    if (inZen()) {
      // No clock at all: the word waits for you.
      G.wordStart = G.wordShownAt;
      G.phase = "playing";
      resetInput();
      bump();
      return;
    }
    if (inSprint()) {
      // One clock for the whole Sprint, started by the first word.
      G.phase = "playing";
      resetInput();
      if (!G.clockStarted) {
        G.clockStarted = true;
        G.wordStart = Date.now();
        runClock(1);
      }
      bump();
      return;
    }
    G.wordStart = Date.now();
    G.frozen = false;
    if (G.slowWords > 0) {
      G.wordLimit = wordClock() * REWARDS.slowFactor;
      G.slowWords--;
    } else G.wordLimit = wordClock();
    G.phase = "playing";
    resetInput();
    runClock(1);
    bump();
  };

  const advance = () => {
    if (G.phase === "over") return;
    if (inSprint() || inZen()) return nextWord();
    if (G.lives <= 0 && !tryPhoenix()) return gameOver();
    if (G.inBoss) {
      if (G.bossHp <= 0) bossDefeated();
      else nextWord(); // a timeout or Skip doesn't hurt the boss: just a new word
      return;
    }
    G.wordInRound++;
    if (G.wordInRound < roundWords()) return nextWord();
    // Survival: every round ends with a boss. Tower: only checkpoint floors have a guardian.
    if (!inTower() || isCheckpointFloor(G.round)) startBoss();
    else nextRound();
  };

  /* ---------- boss fights ---------- */
  const roundWords = () => (inTower() ? TOWER.wordsPerFloor : wordsInRound(G.round));

  const startBoss = () => {
    const finalBoss = inTower() && G.round === TOWER.floors;
    G.inBoss = true;
    G.bossMaxHp = finalBoss ? TOWER.finalBossHp : bossHp(tier()) * (twist()?.bossHpFactor ?? 1);
    G.bossHp = G.bossMaxHp;
    G.bossMisses = 0;
    G.bossArmor = finalBoss ? TOWER.finalBossArmor : 1;
    G.bossChip = 0;
    G.bossRegen = finalBoss;
    G.bossName = finalBoss ? TOWER.finalBossName : pickBossName(G.bossHistory, rng.current.bosses);
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
    later(nextWord, inRush() ? RUSH.introMs : BOSS.introMs);
  };

  const nextRound = () => {
    if (G.roundMisses === 0) G.perfectRounds++;
    if (inTower()) {
      G.floorCleared = G.round;
      if (G.round >= TOWER.floors) return towerComplete();
      if (isCheckpointFloor(G.round)) {
        updateTower({ ...towerRef.current, checkpoint: G.round });
        later(() => addFloat(`Checkpoint saved · floor ${G.round}`, "reward"), 150);
      }
    }
    G.round++;
    startRound();
  };

  const bossDefeated = () => {
    G.inBoss = false;
    G.bossesDefeated++;
    if (G.bossMisses === 0) G.flawlessBosses++;
    if (G.lives === 1 && G.d.lives > 1) G.clutchBosses++;
    const pts =
      BOSS.bonusPointsPerRound * tier() * (inSudden() ? SUDDEN.multiplier : 1) * (twist()?.bossHpFactor ?? 1);
    if (twist()?.id === "giant") G.giantBosses++;
    G.score += pts;
    addFloat(`${G.bossName} defeated! +${pts}`, "reward");
    playVictory(); // stops the boss music and plays the fanfare
    buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
    checkRewards();
    checkAchievements();
    const won = rollBonus(G.bonus, rng.current.bonus, inSudden() ? ["megaLife"] : []);
    if (!G.bonus) {
      G.bonus = won;
      later(() => addFloat(`Bonus power-up: ${BONUS_POWERUPS[won].name}`, "reward"), 700);
      later(nextRound, inRush() ? RUSH.breatherMs : 2600); // let the victory fanfare finish first
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
      if (inSprint()) {
        sprintPenalty();
        bump();
        return;
      }
      if (inZen()) {
        buzz.impact(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); // a gentle nudge, no penalty
        bump();
        return;
      }
      if (G.shields > 0) {
        G.shields--;
        G.shieldBlocks++;
        checkAchievements();
        addFloat("Shield blocked it", "reward", G.pos);
        buzz.notify(Haptics.NotificationFeedbackType.Warning).catch(() => {});
        bump();
        return;
      }
      const cost = twist()?.missCost ?? 1;
      addFloat(G.lives <= cost ? "Miss" : `−${cost} li${cost === 1 ? "fe" : "ves"}`, "bad", G.pos);
      loseLife(cost);
      if (G.lives <= 0 && !tryPhoenix()) {
        G.phase = "between";
        fuse.stopAnimation();
        later(gameOver, 600);
      }
      bump();
    }
  };

  /** `auto`: finished by Auto-Type, so it doesn't count as a fast word. */
  const solved = (auto = false) => {
    const used = (Date.now() - (inSprint() || inZen() ? G.wordShownAt : G.wordStart)) / 1000;
    G.typingSeconds += Math.min(used, G.wordLimit);
    G.lettersTyped += G.word.length;
    let pts = inSprint()
      ? scoreWord(SPRINT.pointsTier, used, SPRINT.wordPar, G.wordMisses)
      : scoreWord(tier(), used, G.wordLimit, G.wordMisses);
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
    if (inSudden()) mult *= SUDDEN.multiplier;
    mult *= twist()?.pointsFactor ?? 1;
    pts = inZen() ? 0 : Math.round(pts * mult * combo); // Zen keeps no score
    G.score += pts;
    let cracked = false; // an armored block took a hit but didn't break
    if (G.inBoss) {
      G.bossChip++;
      if (G.bossChip >= G.bossArmor) {
        G.bossChip = 0;
        G.bossHp = Math.max(0, G.bossHp - 1);
      } else cracked = true;
    }
    G.wordsTyped++;
    const tw = twist();
    if (tw?.healOnFlawless && G.wordMisses === 0 && G.lives < maxLives()) {
      G.lives++;
      const p = pips[G.lives - 1];
      p.setValue(1.8);
      Animated.spring(p, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      later(() => addFloat("+1 life", "reward"), 450);
    }
    if (tw?.powerUpEvery && !G.inBoss && (G.wordInRound + 1) % tw.powerUpEvery === 0) givePowerUp("Power Surge");
    if (!auto) {
      if (!G.fastest || used < G.fastest.t) G.fastest = { t: used, w: G.word };
      if (G.word.length >= 7 && (G.fastestLong === null || used < G.fastestLong)) G.fastestLong = used;
      if (G.word.length >= 5 && (G.fastestMid === null || used < G.fastestMid)) G.fastestMid = used;
    }
    G.phase = "between";
    G.look = "solved";
    if (!inSprint()) fuse.stopAnimation(); // the Sprint clock keeps running
    const hit = G.inBoss ? (cracked ? " · armor cracked" : G.bossHp > 0 ? " · hit!" : " · final blow!") : "";
    const tags = [mult > 1 ? `${mult}×` : "", combo > 1 ? `combo ×${combo}` : ""].filter(Boolean).join(", ");
    if (inZen()) addFloat(`${used.toFixed(2)}s${G.wordMisses === 0 ? " · clean" : ""}`, "good");
    else addFloat(`+${pts}${tags ? ` (${tags})` : ""}${G.wordMisses === 0 && !hit && !tags ? " flawless" : ""}${hit}`, "good");
    play("word");
    buzz.impact(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (!inSprint() && !inZen()) checkRewards(); // no power-ups in Sprint or Zen
    checkAchievements();
    bump();
    later(advance, inSprint() ? 140 : 260);
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
      const cost = CONFIG.timeoutCost * (twist()?.missCost ?? 1);
      addFloat(G.lives <= cost ? "Too slow" : `Too slow · −${cost} li${cost === 1 ? "fe" : "ves"}`, "bad");
      loseLife(cost);
    }
    // The Typo Tyrant feeds on slowness: a timeout repairs its armor, or regrows a block.
    if (G.inBoss && G.bossRegen) {
      if (G.bossChip > 0) {
        G.bossChip = 0;
        later(() => addFloat(`${G.bossName} repairs its armor!`, "bad"), 300);
      } else if (G.bossHp < G.bossMaxHp) {
        G.bossHp++;
        later(() => addFloat(`${G.bossName} regenerates! +1 block`, "bad"), 300);
      }
    }
    bump();
    later(advance, 650);
  };

  const gameOver = () => {
    if (G.phase === "over") return;
    G.phase = "over";
    fuse.stopAnimation();
    if (G.towerTop) playVictory();
    else if (inZen()) {
      playMusic(null);
      play("round"); // a calm chime, not the game-over sound
    } else {
      playMusic(null);
      play("over");
    }
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
    if (inTower()) return false; // Tower scores aren't Survival bests
    if (inMix()) {
      const b = mixBestRef.current;
      const next = { score: Math.max(b.score, G.score), round: Math.max(b.round, G.round) };
      if (next.score !== b.score || next.round !== b.round) {
        mixBestRef.current = next;
        setMixBest(next);
        saveMix(next);
      }
      return G.score > b.score;
    }
    if (inSudden()) {
      const id = G.d.id;
      if (G.score <= suddenBestRef.current[id]) return false;
      suddenBestRef.current = { ...suddenBestRef.current, [id]: G.score };
      setSuddenBest(suddenBestRef.current);
      saveSudden(suddenBestRef.current);
      return true;
    }
    if (inRush()) {
      const b = rushBestRef.current;
      const next = { bosses: Math.max(b.bosses, G.bossesDefeated), score: Math.max(b.score, G.score) };
      if (next.bosses !== b.bosses || next.score !== b.score) {
        rushBestRef.current = next;
        setRushBest(next);
        saveRush(next);
      }
      return G.bossesDefeated > b.bosses || (G.bossesDefeated === b.bosses && G.score > b.score);
    }
    if (inZen()) {
      const b = zenBestRef.current;
      const speed = G.wordsTyped >= ZEN.minWordsForBest ? zenWpm() : 0;
      const next = { words: Math.max(b.words, G.wordsTyped), wpm: Math.max(b.wpm, speed), sessions: b.sessions + 1 };
      zenBestRef.current = next;
      setZenBest(next);
      saveZen(next);
      return speed > b.wpm;
    }
    if (inSprint()) {
      const b = sprintBestRef.current;
      const words = G.wordsTyped;
      const speed = wpm(G.lettersTyped, sprintSeconds());
      const next = { score: Math.max(b.score, G.score), words: Math.max(b.words, words), wpm: Math.max(b.wpm, speed) };
      if (next.score !== b.score || next.words !== b.words || next.wpm !== b.wpm) {
        sprintBestRef.current = next;
        setSprintBest(next);
        saveSprint(next);
      }
      return G.score > b.score;
    }
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
        `Typo Tyrant Daily Challenge · ${prettyDate(G.dailyDate)}\n` +
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
    G.pausedAt = Date.now();
    setConfirmQuit(false);
    pauseMusic();
    popOverlay();
    bump();
  };

  const resume = () => {
    if (G.phase !== "paused") return;
    const elapsedFrac = 1 - G.pausedRemaining;
    if (!inZen()) G.wordStart = Date.now() - elapsedFrac * G.wordLimit * 1000;
    G.frozen = false; // pausing uses up what was left of a Freeze
    G.wordShownAt += Date.now() - G.pausedAt; // don't count the pause against this word's time
    G.phase = "playing";
    resumeMusic();
    focusInput();
    if (!inZen()) runClock(G.pausedRemaining);
    bump();
  };

  /* ---------- rewards & power-ups ---------- */
  const checkRewards = () => {
    while (G.score >= G.nextRewardAt) {
      G.rewardsEarned++;
      G.nextRewardAt = rewardThreshold(G.rewardsEarned);
      if (!givePowerUp("New power-up")) later(() => addFloat("Bucket full · reward lost", "bad"), 280);
    }
    if (G.bucketFilled) checkAchievements();
  };

  /** Sprint: seconds of the minute used so far. */
  const sprintSeconds = () => {
    if (!G.clockStarted) return 0;
    if (G.phase === "over") return SPRINT.seconds - remainingAtEnd();
    return Math.min(SPRINT.seconds, SPRINT.seconds - remainingSeconds());
  };
  const remainingAtEnd = () => (G.phase === "paused" ? G.pausedRemaining * G.wordLimit : 0);

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
        if (G.lives >= maxLives()) return "Lives are full";
        const before = G.lives;
        G.lives = Math.min(maxLives(), G.lives + BONUS.megaLives);
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
    if (twist()?.lockPowerUps) {
      addFloat("Power-ups are locked this round", "bad");
      return;
    }
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
        if (G.lives >= maxLives()) return "Lives are full";
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
    if (twist()?.lockPowerUps) {
      addFloat("Power-ups are locked this round", "bad");
      return;
    }
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
    if (t.id !== "classic" && !proRef.current) return openPaywall();
    setThemeId(t.id);
    saveTheme(t.id);
    buzz.select().catch(() => {});
  };

  const choosePack = (p: WordPack) => {
    if (!meetsRequirement(p.requires, unlockedRef.current)) return;
    if (p.id !== "classic" && !proRef.current) return openPaywall();
    setPackId(p.id);
    packRef.current = p.id;
    savePack(p.id);
    buzz.select().catch(() => {});
  };

  /* ---------- Pro ---------- */
  const openPaywall = () => {
    setPaywallMsg("");
    setShowPaywall(true);
    Keyboard.dismiss();
  };

  const setProOwned = (on: boolean) => {
    proRef.current = on;
    setPro(on);
    savePro(on);
  };

  const purchasePro = async () => {
    if (paywallBusy) return;
    setPaywallBusy(true);
    setPaywallMsg("");
    const r = await buyPro();
    setPaywallBusy(false);
    if (r.ok) {
      setProOwned(true);
      setShowPaywall(false);
      play("achieve");
      buzz.notify(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toastQueue.current.push({ eyebrow: "WELCOME TO PRO", name: "Everything is unlocked", desc: "Thanks for supporting Typo Tyrant!" });
      if (!toastShowing.current) showNextToast();
    } else if (!r.cancelled) setPaywallMsg(r.reason);
  };

  const restore = async () => {
    if (paywallBusy) return;
    setPaywallBusy(true);
    setPaywallMsg("");
    const r = await restorePro();
    setPaywallBusy(false);
    if (r.ok) {
      setProOwned(true);
      setShowPaywall(false);
      setPaywallMsg("");
    } else setPaywallMsg(r.reason);
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
      towerRef.current = EMPTY_TOWER;
      setTower(EMPTY_TOWER);
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
    else if (G.phase === "banner") closeTwistCard();
  };

  /* ---------- render ---------- */
  const climbing = G.mode === "tower";
  const sprinting = G.mode === "sprint";
  const zenMode = G.mode === "zen";
  const rushMode = G.mode === "rush";
  const suddenMode = G.mode === "sudden";
  const mixMode = G.mode === "mix";
  const mixTwist = mixMode && G.twist ? MIX_TWISTS[G.twist] : null;
  // Vanishing: letters you haven't typed yet hide a moment after the word appears.
  const lettersHidden = !!mixTwist?.vanish && G.phase === "playing" && Date.now() - G.wordShownAt >= MIX.vanishMs;
  const liveWpm = sprinting ? wpm(G.lettersTyped, sprintSeconds()) : 0;
  const total = climbing ? TOWER.wordsPerFloor : wordsInRound(G.round);
  const startLives = climbing ? TOWER.lives : G.mode === "rush" ? RUSH.lives : G.mode === "sudden" ? 1 : G.d.lives;
  const oneLife = startLives === 1;
  const showNoLives = oneLife && G.lives <= 1; // Impossible, unless an Extra Life was used
  const low = !oneLife && G.lives > 0 && G.lives <= Math.ceil(startLives * 0.3);
  const bestHere = best[G.d.id];
  const fontSize = currentFontSize();
  const hotOpacity = fuse.interpolate({ inputRange: [0, 0.3, 0.31, 1], outputRange: [1, 1, 0, 0] });
  const accuracy = G.keys ? `${Math.round((G.goodKeys / G.keys) * 100)}%` : "–";
  const prevLimit = G.round > 1 ? timeForRound(G.round - 1, G.d) : G.limit;
  let bannerNote = "";
  if (G.mode === "mix" && G.twist) {
    bannerNote = `${MIX_TWISTS[G.twist].name}: ${MIX_TWISTS[G.twist].desc}`;
  } else if (G.mode === "sudden" && G.round === 1) {
    bannerNote = `Sudden Death · one life · ${SUDDEN.multiplier}× points`;
  } else if (climbing) {
    bannerNote = isCheckpointFloor(G.round)
      ? G.round === TOWER.floors
        ? "The final floor · the Typo Tyrant waits at the top"
        : "Checkpoint floor · beat the guardian to save"
      : `Next checkpoint: floor ${nextCheckpoint(G.round)}`;
  } else if (G.round > 1) {
    bannerNote = G.limit < prevLimit ? `Clock −${formatSeconds(prevLimit - G.limit)}` : "Clock at its fastest";
    if (wordsInRound(G.round) > wordsInRound(G.round - 1)) bannerNote += " · Longer round";
  }

  return (
    <View style={[s.root, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, kbHeight) + 12 }]}>
      <StatusBar style={isDark || G.inBoss ? "light" : "dark"} />

      {/* HUD */}
      <View style={s.hud}>
        <View style={s.stat}>
          <Text style={s.label}>{zenMode ? "WORDS" : "SCORE"}</Text>
          <Text style={s.value}>{zenMode ? G.wordsTyped : G.score.toLocaleString()}</Text>
          <Text style={s.meta}>
            {G.daily
              ? `Daily · ${prettyDate(G.dailyDate)}`
              : zenMode
                ? "Zen · no clock"
                : rushMode
                ? `Boss Rush · Best ${Math.max(rushBest.bosses, G.bossesDefeated)}`
                : mixMode
                ? `Mix · Best ${Math.max(mixBest.score, G.score).toLocaleString()}`
                : suddenMode
                ? `Sudden ${G.d.label} · Best ${Math.max(suddenBest[G.d.id], G.score).toLocaleString()}`
                : climbing
                ? `Tower · checkpoint ${tower.checkpoint || "–"}`
                : sprinting
                  ? `Sprint · Best ${Math.max(sprintBest.score, G.score).toLocaleString()}`
                  : `${G.d.label} · Best ${Math.max(bestHere, G.score).toLocaleString()}`}
          </Text>
        </View>
        <ComboBadge c={c} streak={G.streak} pop={comboPop} streakOnly={zenMode} />
        <View style={[s.stat, { alignItems: "flex-end" }]}>
          <Text style={s.label}>{climbing ? "FLOOR" : sprinting ? "WORDS" : zenMode ? "SPEED" : rushMode ? "BOSS" : "ROUND"}</Text>
          <Text style={s.value}>{sprinting ? G.wordsTyped : zenMode ? zenWpm() : G.round}</Text>
          <Text style={s.meta}>
            {zenMode ? `wpm · ${accuracy} accurate` : sprinting ? `${liveWpm} wpm` : G.inBoss ? `boss · ${G.bossHp} of ${G.bossMaxHp} HP` : `word ${Math.min(G.wordInRound + 1, total)} of ${total}`}
          </Text>
        </View>
      </View>
      <View style={s.livesRow}>
        <Text style={[s.label, (low || showNoLives) && { color: c.miss }]}>
          {zenMode
            ? "NO LIVES · NO CLOCK · TAKE YOUR TIME"
            : sprinting
            ? `NO LIVES · A MISS COSTS ${SPRINT.missPenalty} SECOND`
            : showNoLives
              ? "NO LIVES · ONE MISS ENDS IT"
              : `LIVES ${G.lives}`}
        </Text>
        <View style={[s.pips, (showNoLives || sprinting || zenMode) && { display: "none" }]}>
          {pips.slice(0, Math.max(startLives, G.lives)).map((p, i) => {
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

      {mixTwist && G.phase !== "title" && (
        <Text style={[s.label, { textAlign: "center", marginTop: 8, color: c.gold }]} numberOfLines={1}>
          {mixTwist.name.toUpperCase()} · {mixTwist.desc}
        </Text>
      )}

      {G.inBoss && G.phase !== "banner" && (
        <View
          style={s.bossBar}
          accessibilityLabel={`${G.bossName}: ${G.bossHp} of ${G.bossMaxHp} health left${G.bossArmor > 1 ? `, armored: ${G.bossArmor} words per block` : ""}`}
        >
          <Text style={[s.label, { color: G.bossArmor > 1 ? c.gold : c.miss }]} numberOfLines={1}>
            {G.bossArmor > 1 ? "FINAL BOSS" : "BOSS"} · {G.bossName.toUpperCase()}
          </Text>
          <View style={[s.bossHpRow, G.bossArmor > 1 && [s.bossArmored, { borderColor: c.gold }]]}>
            {Array.from({ length: G.bossMaxHp }, (_, i) => {
              const alive = i < G.bossHp;
              const cracked = alive && i === G.bossHp - 1 && G.bossChip > 0; // armored block that's taken a hit
              return (
                <View
                  key={i}
                  style={[
                    s.bossHpSeg,
                    { backgroundColor: alive ? c.miss : c.line },
                    G.bossArmor > 1 && { height: 16 },
                    G.bossArmor > 1 && alive && { borderWidth: 2, borderColor: c.gold },
                  ]}
                >
                  {cracked && (
                    <View
                      style={[
                        s.bossCrack,
                        { width: `${(G.bossChip / G.bossArmor) * 100}%`, backgroundColor: c.line },
                      ]}
                    />
                  )}
                </View>
              );
            })}
          </View>
          {G.bossArmor > 1 && (
            <Text style={[s.meta, { color: c.gold }]} numberOfLines={1}>
              Armored · {G.bossArmor} words per block{G.bossRegen ? " · heals when you're too slow" : ""}
            </Text>
          )}
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
              if (lettersHidden && !done && !wrong) color = "transparent";
              // Masked: every other letter shows as "_" until it's typed.
              const masked = !!mixTwist?.masked && i % 2 === 1 && !done && !wrong && G.look === "normal";
              return (
                <Animated.View
                  key={i}
                  style={[
                    s.letterBox,
                    wrong && { backgroundColor: c.missSoft },
                    wrong && { transform: [{ scale: letterPop }] },
                  ]}
                >
                  <Text style={[s.letter, { fontSize, color: masked ? c.muted : color }]} allowFontScaling={false}>
                    {masked ? "_" : ch}
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
          <View style={[s.fuseTrack, zenMode && { display: "none" }]}>
            <Animated.View style={[s.fuseFill, { backgroundColor: c.accent, transform: [{ scaleX: fuse }] }]} />
            <Animated.View
              style={[s.fuseFill, s.fuseHot, { backgroundColor: c.miss, opacity: hotOpacity, transform: [{ scaleX: fuse }] }]}
            />
          </View>
          <View style={s.fuseRow}>
            {zenMode ? (
              <>
                <Text style={s.meta}>No clock · type at your own pace</Text>
                <ZenTimer seconds={zenSeconds} style={s.meta} />
              </>
            ) : (
              <>
                <Text style={s.meta}>
                  {sprinting ? "Sprint clock " : "Time per word "}
                  <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>
                    {formatSeconds(G.phase === "banner" || G.phase === "title" ? G.limit : G.wordLimit)}
                  </Text>
                </Text>
                <Remaining G={G} style={s.meta} />
              </>
            )}
          </View>
        </View>

        <Text style={s.hint}>
          {G.phase === "playing" && sprinting && G.wordsTyped === 0
            ? `As many words as you can. Wrong letters cost ${SPRINT.missPenalty} second.`
            : G.phase === "playing" && zenMode && G.wordsTyped === 0
            ? "No clock and no lives. Tap FINISH when you're done."
            : G.phase === "playing" && G.round === 1 && G.wordInRound === 0
            ? oneLife
              ? "Type the word. One wrong letter ends the game."
              : "Type the word. Wrong letters cost a life."
            : kbHeight === 0 && (G.phase === "playing" || G.phase === "banner")
              ? "Tap here to bring up the keyboard"
              : " "}
        </Text>
      </Pressable>

      {!sprinting && !zenMode && <PowerUpTray c={c} G={G} onUse={activatePowerUp} onUseBonus={activateBonus} />}

      <View style={s.controls}>
        <Pressable style={s.chip} onPress={() => (G.phase === "paused" ? resume() : pause())} hitSlop={8}>
          <Text style={s.chipText}>{G.phase === "paused" ? "RESUME" : "PAUSE"}</Text>
        </Pressable>
        {zenMode && G.phase !== "over" && G.phase !== "title" && (
          <Pressable
            style={[s.chip, { borderColor: c.accent }]}
            onPress={finishZen}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Finish the Zen session"
          >
            <Text style={[s.chipText, { color: c.accent }]}>FINISH</Text>
          </Pressable>
        )}
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
          <Text style={s.h1}>Typo Tyrant</Text>
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
          <Text style={s.label}>OR PICK A MODE</Text>
          <Pressable
            onPress={() => setShowModes(true)}
            style={({ pressed }) => [s.modeButton, pressed && { transform: [{ scale: 0.98 }] }]}
            accessibilityRole="button"
            accessibilityLabel={`Game mode: ${MODE_BY_ID[mode].name}. Change mode`}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[s.diffLabel, { color: c.accent }]}>{MODE_BY_ID[mode].name}</Text>
              <Text style={s.diffWords}>{MODE_BY_ID[mode].tagline}</Text>
            </View>
            <View style={s.chip}>
              <Text style={s.chipText}>CHANGE</Text>
            </View>
          </Pressable>
          {isProMode(mode) && !pro && (
            <Pressable onPress={openPaywall} style={s.proLine} accessibilityRole="button">
              <Text style={s.proBadge}>PRO</Text>
              <Text style={[s.slotEffect, { flex: 1 }]}>
                {trialsLeft(trials, mode, todayKey()) > 0
                  ? "Pro mode · you have a free try today"
                  : "Pro mode · today’s free try is used. Tap to unlock Pro."}
              </Text>
            </Pressable>
          )}
          {mode === "mix" ? (
            <>
              <View style={s.towerCard}>
                <Text style={[s.label, { color: c.gold }]}>MARATHON MIX</Text>
                <Text style={s.dailyTitle}>
                  {mixBest.score ? `Best ${mixBest.score.toLocaleString()} · round ${mixBest.round}` : "Expect the unexpected"}
                </Text>
                <Text style={s.slotEffect}>
                  Medium rules · 10 lives · every round has a twist:{" "}
                  {(Object.values(MIX_TWISTS) as { id: MixTwistId; name: string }[])
                    .filter(t => t.id !== "warmup")
                    .map(t => t.name)
                    .join(", ")}
                </Text>
              </View>
              <Btn c={c} label="Start Marathon Mix" onPress={() => startGame()} />
            </>
          ) : mode === "sudden" ? (
            <>
              <Text style={s.label}>DIFFICULTY</Text>
              <View style={s.diffGrid} accessibilityRole="radiogroup">
                {DIFFICULTY_ORDER.map(id => (
                  <DifficultyCard
                    key={id}
                    c={c}
                    d={DIFFICULTIES[id]}
                    best={suddenBest[id]}
                    selected={difficulty === id}
                    onPress={() => chooseDifficulty(id)}
                    livesOverride={1}
                  />
                ))}
              </View>
              <Text style={[s.slotEffect, { color: c.miss }]}>
                One life on any difficulty. A wrong letter or a slow word ends it. Every point counts {SUDDEN.multiplier}×, and
                extra lives never drop.
              </Text>
              <Btn c={c} label={`Start Sudden Death · ${G.d.label}`} onPress={() => startGame()} />
            </>
          ) : mode === "rush" ? (
            <>
              <View style={s.towerCard}>
                <Text style={[s.label, { color: c.miss }]}>BOSS RUSH</Text>
                <Text style={s.dailyTitle}>
                  {rushBest.bosses
                    ? `Best: ${rushBest.bosses} boss${rushBest.bosses === 1 ? "" : "es"}`
                    : "How many bosses can you beat?"}
                </Text>
                <Text style={s.slotEffect}>
                  {rushBest.score ? `Top score ${rushBest.score.toLocaleString()} · ` : ""}
                  {RUSH.lives} lives · Medium rules · every boss is a little faster · a gold bonus after each win
                </Text>
              </View>
              <Btn c={c} label="Start Boss Rush" onPress={() => startGame()} />
            </>
          ) : mode === "zen" ? (
            <>
              <View style={s.towerCard}>
                <Text style={[s.label, { color: c.gold }]}>ZEN · PRACTICE</Text>
                <Text style={s.dailyTitle}>{zenBest.wpm ? `Best ${zenBest.wpm} wpm` : "No clock, no pressure"}</Text>
                <Text style={s.slotEffect}>
                  {zenBest.sessions
                    ? `Longest session ${zenBest.words} words · ${zenBest.sessions} session${zenBest.sessions === 1 ? "" : "s"} · `
                    : ""}
                  Wrong letters turn red but cost nothing · tap Finish to see your speed and accuracy
                </Text>
              </View>
              <Btn c={c} label="Start Zen" onPress={() => startGame()} />
            </>
          ) : mode === "sprint" ? (
            <>
              <View style={s.towerCard}>
                <Text style={[s.label, { color: c.gold }]}>SPRINT · {SPRINT.seconds} SECONDS</Text>
                <Text style={s.dailyTitle}>
                  {sprintBest.score ? `Best ${sprintBest.score.toLocaleString()} points` : "No sprints yet"}
                </Text>
                <Text style={s.slotEffect}>
                  {sprintBest.score ? `Most words ${sprintBest.words} · top speed ${sprintBest.wpm} wpm · ` : ""}No lives, no
                  power-ups · a wrong letter costs {SPRINT.missPenalty} second
                </Text>
              </View>
              <Btn c={c} label="Start sprint" onPress={() => startGame()} />
            </>
          ) : mode === "classic" ? (
            <>
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
              {tower.cleared && (
                <Text style={[s.slotEffect, { color: c.gold }]}>
                  Phoenix Feather ready: once per game, losing your last life brings you back with {PHOENIX.lives}.
                </Text>
              )}
              <Btn c={c} label={`Start ${G.d.label}`} onPress={() => startGame()} />
            </>
          ) : (
            <>
              <TowerCard c={c} t={tower} />
              <Btn
                c={c}
                label={tower.checkpoint ? `Climb from floor ${tower.checkpoint + 1}` : "Start climbing"}
                onPress={() => startGame()}
              />
            </>
          )}
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
          {!pro && (
            <Pressable
              onPress={openPaywall}
              style={({ pressed }) => [s.proCta, pressed && { transform: [{ scale: 0.98 }] }]}
              accessibilityRole="button"
            >
              <Text style={[s.label, { color: c.gold }]}>TYPO TYRANT PRO</Text>
              <Text style={s.dailyTitle}>Unlock every mode and theme</Text>
              <Text style={s.slotEffect}>One payment of {proPrice} · no subscription, no ads</Text>
            </Pressable>
          )}
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
            <StatsBody
              c={c}
              life={lifetime}
              best={best}
              streak={dailyStreak}
              unlockedCount={Object.keys(unlocked).length}
              sprint={sprintBest}
              tower={tower}
              zen={zenBest}
              rush={rushBest}
              sudden={suddenBest}
              mix={mixBest}
            />
          )}
          <Btn c={c} label="Done" onPress={() => setShowStats(false)} />
        </Overlay>
      )}

      {G.phase === "title" && showModes && (
        <Overlay c={c} pop={overlayPop}>
          <View style={s.achHead}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={s.eyebrow}>GAME MODES</Text>
              <Text style={s.h2}>Pick a mode</Text>
            </View>
            <Pressable style={s.chip} onPress={() => setShowModes(false)} hitSlop={10} accessibilityRole="button">
              <Text style={s.chipText}>CLOSE</Text>
            </Pressable>
          </View>
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {MODES.map(m => (
              <Pressable
                key={m.id}
                onPress={() => chooseMode(m.id)}
                style={[s.modeCard, mode === m.id && { borderColor: c.accent, backgroundColor: c.accentSoft }]}
                accessibilityRole="radio"
                accessibilityState={{ selected: mode === m.id }}
              >
                <View style={s.bonusRow}>
                  <Text style={[s.diffLabel, mode === m.id && { color: c.accent }]}>{m.name}</Text>
                  {isProMode(m.id) && !pro && <Text style={s.proBadge}>PRO</Text>}
                  {mode === m.id && <Text style={s.achDate}>SELECTED</Text>}
                </View>
                <Text style={[s.diffDetail, { fontVariant: undefined }]}>{m.tagline}</Text>
                <Text style={s.diffWords}>{m.detail}</Text>
              </Pressable>
            ))}
          </View>
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
          <Text style={s.body}>
            Earn achievements to unlock new color themes and word packs.{pro ? "" : " Using them needs Typo Tyrant Pro."}
          </Text>
          <Text style={s.label}>COLOR THEME</Text>
          <View style={s.diffGrid} accessibilityRole="radiogroup">
            {THEMES.map(t => (
              <ThemeCard
                key={t.id}
                c={c}
                t={t}
                preview={themePalette(t.id, systemDark).c}
                open={meetsRequirement(t.requires, unlocked) && (pro || t.id === "classic")}
                needsPro={meetsRequirement(t.requires, unlocked) && !pro && t.id !== "classic"}
                selected={(pro ? themeId : "classic") === t.id}
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
                open={meetsRequirement(p.requires, unlocked) && (pro || p.id === "classic")}
                needsPro={meetsRequirement(p.requires, unlocked) && !pro && p.id !== "classic"}
                selected={(pro ? packId : "classic") === p.id}
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
            k="MIX"
            v="Marathon Mix: Survival on Medium where every round has a twist, like backwards words, vanishing letters, giant bosses or double-or-nothing."
          />
          <Rule
            c={c}
            k="SUDDEN"
            v={`Sudden Death: Survival on any difficulty with one life and ${SUDDEN.multiplier}× points. Extra lives never drop.`}
          />
          <Rule
            c={c}
            k="RUSH"
            v={`Boss Rush: nothing but bosses, each a little faster than the last, with ${RUSH.lives} lives. Every win gives you a gold bonus.`}
          />
          <Rule
            c={c}
            k="ZEN"
            v="Zen: no clock, no lives and no score. Type at your own pace and tap Finish to see your speed and accuracy."
          />
          <Rule
            c={c}
            k="SPRINT"
            v={`Sprint: ${SPRINT.seconds} seconds to type as many words as you can. No lives or power-ups; each wrong letter takes ${SPRINT.missPenalty} second off the clock.`}
          />
          <Rule
            c={c}
            k="TOWER"
            v={`Tower Climb: ${TOWER.floors} floors of ${TOWER.wordsPerFloor} words on Medium rules with just ${TOWER.lives} lives. Every ${TOWER.checkpointEvery}th floor has a guardian; beat it to save a checkpoint. Defeat the Typo Tyrant on floor ${TOWER.floors} to unlock the Phoenix Feather for Survival.`}
          />
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
              <Text style={s.label}>TYPO TYRANT PRO</Text>
              <View style={s.setGroup}>
                <View style={[s.setRow, { borderBottomWidth: 1, borderBottomColor: c.line }]}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[s.slotName, { color: pro ? c.gold : c.ink }]}>{pro ? "Pro unlocked" : "Free version"}</Text>
                    <Text style={s.slotEffect}>
                      {pro ? "Every mode, theme and word pack. Thank you!" : `Unlock every mode and theme for ${proPrice}`}
                    </Text>
                  </View>
                  {!pro && (
                    <Pressable style={[s.chip, { borderColor: c.gold }]} onPress={openPaywall} hitSlop={8}>
                      <Text style={[s.chipText, { color: c.gold }]}>UNLOCK</Text>
                    </Pressable>
                  )}
                </View>
                <Pressable style={s.setRow} onPress={restore} accessibilityRole="button">
                  <Text style={[s.slotName, { color: c.ink, flex: 1 }]}>Restore purchases</Text>
                  <Text style={s.slotEffect}>{paywallBusy ? "Checking…" : ""}</Text>
                </Pressable>
              </View>
              {paywallMsg && !showPaywall ? <Text style={s.slotEffect}>{paywallMsg}</Text> : null}
              {PURCHASES_TEST_MODE && pro && (
                <Btn c={c} label="Turn Pro off (test mode only)" onPress={() => setProOwned(false)} secondary />
              )}

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
            Typo Tyrant {APP_VERSION} · Music and sounds are original, made for this game · Fonts: Bricolage Grotesque, IBM Plex
            Mono and Inter (SIL Open Font License)
          </Text>
          <Btn c={c} label="Done" onPress={() => setShowSettings(false)} />
        </Overlay>
      )}

      {G.phase === "banner" && mixTwist && !G.inBoss && (
        <Pressable
          style={[StyleSheet.absoluteFill, s.scrim]}
          onPress={() => closeTwistCard()}
          accessibilityRole="button"
          accessibilityLabel={`Round ${G.round}: ${mixTwist.name}. ${mixTwist.desc} Tap to start.`}
        >
          <Animated.View style={[s.panel, s.twistCard, { transform: [{ scale: overlayPop }] }]}>
            <Text style={[s.eyebrow, { color: c.gold }]}>
              ROUND {G.round} · {G.round === 1 ? "MARATHON MIX" : "NEW TWIST"}
            </Text>
            <Text style={s.h2}>{mixTwist.name}</Text>
            <Text style={[s.body, { color: c.ink, fontSize: 17, lineHeight: 24 }]}>{mixTwist.desc}</Text>
            <View style={s.activeRow}>
              {twistChips(mixTwist).map(chip => (
                <View key={chip.text} style={[s.activeChip, { borderColor: chip.bad ? c.miss : c.good }]}>
                  <Text style={[s.activeText, { color: chip.bad ? c.miss : c.good }]}>{chip.text}</Text>
                </View>
              ))}
            </View>
            <Text style={s.meta}>
              {total} words · {formatSeconds(G.limit)} per word · then a boss
            </Text>
            <View style={s.fuseTrack}>
              <Animated.View style={[s.fuseFill, { backgroundColor: c.gold, transform: [{ scaleX: twistTimer }] }]} />
            </View>
            <Text style={[s.meta, { textAlign: "center" }]}>Tap anywhere to start</Text>
          </Animated.View>
        </Pressable>
      )}

      {G.phase === "banner" && !(mixTwist && !G.inBoss) && (
        <View style={[StyleSheet.absoluteFill, s.bannerWrap]} pointerEvents="none">
          {G.inBoss ? (
            <Animated.View style={[s.banner, { transform: [{ scale: overlayPop }] }]}>
              <Text style={[s.label, { color: c.miss, letterSpacing: 4 }]}>
                {climbing
                  ? G.round === TOWER.floors
                    ? "FINAL GUARDIAN"
                    : "CHECKPOINT GUARDIAN"
                  : rushMode
                    ? `BOSS RUSH · BOSS ${G.round}`
                    : "BOSS FIGHT"}
              </Text>
              <Text style={s.bossName}>{G.bossName}</Text>
              <Text style={s.bannerSub}>
                Type <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{G.bossMaxHp * G.bossArmor}</Text> words to
                defeat it ·{" "}
                <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{formatSeconds(G.limit)}</Text> per word
              </Text>
              <Text style={[s.bannerNote, { color: c.gold }]}>
                {climbing
                  ? G.round === TOWER.floors
                    ? `Armored: ${G.bossArmor} words per block · it heals every time you run out of time`
                    : `Beat it to save floor ${G.round} as a checkpoint`
                  : "Win a gold bonus power-up"}
              </Text>
            </Animated.View>
          ) : (
          <Animated.View style={[s.banner, { transform: [{ scale: overlayPop }] }]}>
            <Text style={s.label}>{climbing ? `FLOOR · OF ${TOWER.floors}` : sprinting ? "SPRINT" : zenMode ? "ZEN MODE" : "ROUND"}</Text>
            {zenMode ? (
              <>
                <Text style={[s.bannerBig, { fontSize: 80, lineHeight: 86 }]}>Breathe</Text>
                <Text style={s.bannerSub}>No clock · no lives · no score</Text>
                <Text style={s.bannerNote}>Tap FINISH when you’re done</Text>
              </>
            ) : (
            <Text style={s.bannerBig}>{sprinting ? SPRINT.seconds : G.round}</Text>
            )}
            {zenMode ? null : sprinting ? (
              <>
                <Text style={s.bannerSub}>seconds · as many words as you can</Text>
                <Text style={s.bannerNote}>A wrong letter costs {SPRINT.missPenalty} second</Text>
              </>
            ) : (
            <>
            <Text style={s.bannerSub}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{total}</Text> words ·{" "}
              <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{formatSeconds(G.limit)}</Text> per word
            </Text>
            {bannerNote ? <Text style={s.bannerNote}>{bannerNote}</Text> : null}
            </>
            )}
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
          <Text style={s.body}>{zenMode ? "Your word will be waiting." : "The clock is stopped. Your word will be waiting."}</Text>
          {confirmQuit ? (
            <>
              <Text style={[s.body, { color: c.ink }]}>
                {mixMode
                  ? `Quit this run? Your score of ${G.score.toLocaleString()} still counts toward your Mix best.`
                  : suddenMode
                  ? `Quit this run? Your score of ${G.score.toLocaleString()} still counts toward your Sudden Death best.`
                  : rushMode
                  ? `Quit this rush? Your ${G.bossesDefeated} boss${G.bossesDefeated === 1 ? "" : "es"} still count toward your best.`
                  : zenMode
                  ? "Leave this session? Use FINISH instead to see your summary."
                  : sprinting
                  ? "Quit this sprint? Your score still counts toward your Sprint best."
                  : climbing
                  ? `Quit this climb? You'll start from floor ${tower.checkpoint + 1} next time.`
                  : `Quit this run? Your score of ${G.score.toLocaleString()} still counts toward your best.`}
              </Text>
              <Btn c={c} label="Yes, quit to main menu" onPress={quitToMenu} />
              <Btn c={c} label="Keep playing" onPress={resume} secondary />
            </>
          ) : (
            <>
              <Btn c={c} label="Resume" onPress={resume} />
              {zenMode && <Btn c={c} label="Finish and see summary" onPress={finishZen} secondary />}
              <Btn c={c} label="Settings" onPress={openSettings} secondary />
              <Btn c={c} label="Quit to main menu" onPress={() => setConfirmQuit(true)} secondary />
            </>
          )}
        </Overlay>
      )}

      {G.phase === "over" && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={[s.eyebrow, { color: G.daily || G.towerTop ? c.gold : c.miss }]}>
            {G.daily
              ? `DAILY CHALLENGE · ${prettyDate(G.dailyDate).toUpperCase()}`
              : rushMode
                ? "BOSS RUSH · OUT OF LIVES"
                : suddenMode
                ? `SUDDEN DEATH · ${G.d.label.toUpperCase()}`
                : mixMode
                ? "MARATHON MIX · OUT OF LIVES"
                : zenMode
                ? "ZEN · SESSION COMPLETE"
                : sprinting
                ? "SPRINT · TIME'S UP"
                : climbing
                ? G.towerTop
                  ? "TOWER CLIMB · SUMMIT REACHED"
                  : "TOWER CLIMB · OUT OF LIVES"
                : `${G.d.label.toUpperCase()} · ${oneLife ? "GAME OVER" : "OUT OF LIVES"}`}
          </Text>
          <Text style={s.h2}>
            {rushMode
              ? `You beat ${G.bossesDefeated} boss${G.bossesDefeated === 1 ? "" : "es"}`
              : zenMode
              ? `${G.wordsTyped} word${G.wordsTyped === 1 ? "" : "s"}, nicely done`
              : sprinting
              ? `${G.wordsTyped} word${G.wordsTyped === 1 ? "" : "s"} in ${SPRINT.seconds} seconds`
              : climbing
                ? G.towerTop
                  ? "You reached the top!"
                  : `You fell on floor ${G.round}`
                : `You reached round ${G.round}`}
          </Text>
          <View style={s.results}>
            {mixMode ? (
              <Result
                c={c}
                k="SCORE"
                v={G.score.toLocaleString()}
                note={isNewBest ? "New Mix best" : `Mix best ${mixBest.score.toLocaleString()}`}
              />
            ) : suddenMode ? (
              <Result
                c={c}
                k="SCORE"
                v={G.score.toLocaleString()}
                note={isNewBest ? `New Sudden ${G.d.label} best` : `Sudden ${G.d.label} best ${suddenBest[G.d.id].toLocaleString()}`}
              />
            ) : rushMode ? (
              <Result
                c={c}
                k="SCORE"
                v={G.score.toLocaleString()}
                note={isNewBest ? "New Boss Rush best" : `Best ${rushBest.bosses} bosses · ${rushBest.score.toLocaleString()}`}
              />
            ) : zenMode ? (
              <Result
                c={c}
                k="SPEED"
                v={`${zenWpm()} wpm`}
                note={
                  G.wordsTyped >= ZEN.minWordsForBest
                    ? isNewBest
                      ? "New Zen best"
                      : `Zen best ${zenBest.wpm} wpm`
                    : `${ZEN.minWordsForBest}+ words to set a best`
                }
              />
            ) : sprinting ? (
              <Result
                c={c}
                k="SCORE"
                v={G.score.toLocaleString()}
                note={isNewBest ? "New Sprint best" : `Sprint best ${sprintBest.score.toLocaleString()}`}
              />
            ) : climbing ? (
              <Result
                c={c}
                k="FLOORS CLIMBED"
                v={String(Math.max(0, G.floorCleared - G.startFloor + 1))}
                note={`From floor ${G.startFloor}`}
              />
            ) : (
              <Result
                c={c}
                k="SCORE"
                v={G.score.toLocaleString()}
                note={isNewBest ? `New ${G.d.label} best` : `${G.d.label} best ${bestHere.toLocaleString()}`}
              />
            )}
            {zenMode ? (
              <Result c={c} k="TIME" v={formatClock(zenSeconds())} />
            ) : sprinting ? (
              <Result c={c} k="SPEED" v={`${liveWpm} wpm`} note={`Best ${Math.max(sprintBest.wpm, liveWpm)} wpm`} />
            ) : (
              <Result c={c} k="WORDS TYPED" v={String(G.wordsTyped)} />
            )}
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
          {climbing && (
            <Text style={[s.body, { color: c.ink }]}>
              {G.towerTop
                ? `You unlocked the Phoenix Feather: once per Survival game, losing your last life brings you back with ${PHOENIX.lives}. The Tower resets for another climb.`
                : tower.checkpoint
                  ? `Your checkpoint is floor ${tower.checkpoint}, so your next climb starts on floor ${tower.checkpoint + 1}.`
                  : `No checkpoint yet: beat the floor ${TOWER.checkpointEvery} guardian to save one.`}
            </Text>
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
              <Btn
                c={c}
                label={
                  rushMode
                    ? "Rush again"
                    : zenMode
                    ? "New session"
                    : sprinting
                    ? "Sprint again"
                    : climbing
                      ? tower.checkpoint
                        ? `Climb from floor ${tower.checkpoint + 1}`
                        : "Climb again"
                      : "Play again"
                }
                onPress={() => startGame()}
              />
              <Btn c={c} label="Main menu" onPress={toTitle} secondary />
            </>
          )}
        </Overlay>
      )}

      {showPaywall && (
        <Overlay c={c} pop={overlayPop}>
          <View style={s.achHead}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[s.eyebrow, { color: c.gold }]}>TYPO TYRANT PRO</Text>
              <Text style={s.h2}>Unlock everything</Text>
            </View>
            <Pressable style={s.chip} onPress={() => setShowPaywall(false)} hitSlop={10} accessibilityRole="button">
              <Text style={s.chipText}>CLOSE</Text>
            </Pressable>
          </View>
          <View style={{ gap: 10 }}>
            {PRO.perks.map(perk => (
              <View key={perk} style={s.proPerk}>
                <View style={[s.achMark, { borderColor: c.gold, backgroundColor: c.gold }]}>
                  <Text style={[s.achMarkText, { color: c.onAccent }]}>✓</Text>
                </View>
                <Text style={[s.ruleText, { flex: 1 }]}>{perk}</Text>
              </View>
            ))}
          </View>
          <Text style={s.body}>
            Survival, Sprint, Zen and the Daily Challenge stay free forever. Without Pro you still get one free try of each Pro
            mode every day.
          </Text>
          <Btn c={c} label={paywallBusy ? "One moment…" : `Unlock Pro · ${proPrice}`} onPress={purchasePro} />
          <Btn c={c} label="Restore purchases" onPress={restore} secondary />
          {paywallMsg ? <Text style={[s.slotEffect, { color: c.miss, textAlign: "center" }]}>{paywallMsg}</Text> : null}
          {PURCHASES_TEST_MODE && (
            <Text style={[s.slotEffect, { textAlign: "center" }]}>
              Test mode: purchases aren’t connected yet, so unlocking is free on this development build.
            </Text>
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

/** Main menu, Tower Climb: progress up the tower, checkpoints marked. */
function TowerCard({ c, t }: { c: Palette; t: TowerProgress }) {
  const s = styles(c);
  const marks = Array.from({ length: TOWER.floors / TOWER.checkpointEvery }, (_, i) => (i + 1) * TOWER.checkpointEvery);
  return (
    <View style={s.towerCard} accessibilityLabel={`Tower progress: checkpoint ${t.checkpoint}, best floor ${t.best}`}>
      <Text style={[s.label, { color: c.gold }]}>{t.cleared ? "TOWER CLIMB · SUMMIT REACHED" : "TOWER CLIMB"}</Text>
      <Text style={s.dailyTitle}>
        {t.checkpoint ? `Checkpoint: floor ${t.checkpoint}` : "Start at floor 1"}
      </Text>
      <View style={s.towerTrack}>
        <View style={[s.towerFill, { backgroundColor: c.ghost, width: `${t.best}%` }]} />
        <View style={[s.towerFill, { backgroundColor: c.gold, width: `${t.checkpoint}%` }]} />
        {marks.map(m => (
          <View
            key={m}
            style={[s.towerMark, { left: `${m}%`, backgroundColor: m <= t.checkpoint ? c.gold : c.ghost }]}
          />
        ))}
      </View>
      <Text style={s.slotEffect}>
        Best floor {t.best || "–"} · {t.climbs} climb{t.climbs === 1 ? "" : "s"} · Medium rules · {TOWER.lives} lives ·
        checkpoint every {TOWER.checkpointEvery} floors
        {t.cleared ? " · Phoenix Feather unlocked" : " · reach the top for the Phoenix Feather"}
      </Text>
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
  sprint,
  tower,
  zen,
  rush,
  sudden,
  mix,
}: {
  c: Palette;
  life: LifetimeStats;
  best: BestScores;
  streak: DailyStreak;
  unlockedCount: number;
  sprint: SprintBest;
  tower: TowerProgress;
  zen: ZenBest;
  rush: RushBest;
  sudden: BestScores;
  mix: MixBest;
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
      {section("MODES", [
        ["SPRINT BEST", sprint.score ? n(sprint.score) : "–", sprint.words ? `${sprint.words} words max` : undefined],
        ["SPRINT SPEED", sprint.wpm ? `${sprint.wpm} wpm` : "–"],
        ["TOWER BEST FLOOR", tower.best ? n(tower.best) : "–", tower.checkpoint ? `checkpoint ${tower.checkpoint}` : undefined],
        ["TOWER SUMMIT", tower.cleared ? "Reached" : "Not yet"],
        ["ZEN SPEED", zen.wpm ? `${zen.wpm} wpm` : "–", zen.sessions ? `${n(zen.sessions)} sessions` : undefined],
        ["LONGEST ZEN", zen.words ? `${n(zen.words)} words` : "–"],
        [
          "SUDDEN DEATH BEST",
          (() => {
            const top = Math.max(...DIFFICULTY_ORDER.map(id => sudden[id]));
            return top ? n(top) : "–";
          })(),
          (() => {
            const id = DIFFICULTY_ORDER.reduce((a, b) => (sudden[b] > sudden[a] ? b : a));
            return sudden[id] ? `on ${DIFFICULTIES[id].label}` : undefined;
          })(),
        ],
        ["MARATHON MIX BEST", mix.score ? n(mix.score) : "–", mix.round ? `round ${mix.round}` : undefined],
        ["BOSS RUSH BEST", rush.bosses ? `${n(rush.bosses)} bosses` : "–", rush.score ? `${n(rush.score)} points` : undefined],
      ])}
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
  needsPro,
  selected,
  onPress,
}: {
  c: Palette;
  t: Theme;
  preview: Palette;
  open: boolean;
  needsPro?: boolean; // earned, but using it needs Pro (tapping opens the Pro screen)
  selected: boolean;
  onPress: () => void;
}) {
  const s = styles(c);
  return (
    <Pressable
      onPress={onPress}
      disabled={!open && !needsPro}
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
      ) : needsPro ? (
        <Text style={[s.slotEffect, { color: c.gold }]}>Earned · needs Pro</Text>
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
  needsPro,
  selected,
  onPress,
}: {
  c: Palette;
  p: WordPack;
  open: boolean;
  needsPro?: boolean; // earned, but using it needs Pro (tapping opens the Pro screen)
  selected: boolean;
  onPress: () => void;
}) {
  const s = styles(c);
  const sample = p.words ? [p.words[30], p.words[60], p.words[100] ?? p.words[90]].filter(Boolean).join(" · ") : "";
  return (
    <Pressable
      onPress={onPress}
      disabled={!open && !needsPro}
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
        <Text style={[s.slotEffect, needsPro && { color: c.gold }]}>
          {open ? `${p.desc}${sample ? ` ${sample}` : ""}` : needsPro ? "Earned · needs Pro" : requirementText(p.requires)}
        </Text>
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
function ComboBadge({
  c,
  streak,
  pop,
  streakOnly,
}: {
  c: Palette;
  streak: number;
  pop: Animated.Value;
  streakOnly?: boolean; // Zen: no score, so just show the streak
}) {
  const s = styles(c);
  if (streakOnly) {
    return (
      <View style={[s.stat, s.combo]} accessibilityLabel={`Streak ${streak}`}>
        <Text style={s.label}>STREAK</Text>
        <Animated.Text style={[s.value, { color: streak > 0 ? c.good : c.ghost, transform: [{ scale: pop }] }]}>
          {streak}
        </Animated.Text>
        <Text style={s.meta}>clean words</Text>
      </View>
    );
  }
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
  const locked = G.mode === "mix" && !!G.twist && !!MIX_TWISTS[G.twist].lockPowerUps; // Unplugged
  const canUse = G.phase === "playing" && !locked;
  const slowLeft = G.slowWords + (G.wordLimit > G.limit && G.phase !== "banner" ? 1 : 0);
  const active: { text: string; color: string }[] = [];
  if (G.frozen) active.push({ text: "Frozen", color: c.ice });
  if (G.shields > 0) active.push({ text: G.shields > 1 ? `Shield ×${G.shields}` : "Shield on", color: c.violet });
  if (slowLeft > 0) active.push({ text: `Slow-Mo · ${slowLeft} word${slowLeft > 1 ? "s" : ""}`, color: c.good });
  if (G.phoenix) active.push({ text: "Phoenix ready", color: c.gold });
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
  livesOverride,
}: {
  c: Palette;
  d: Difficulty;
  best: number;
  selected: boolean;
  onPress: () => void;
  livesOverride?: number; // Sudden Death: every difficulty has one life
}) {
  const s = styles(c);
  const lives = livesOverride ?? d.lives;
  const health = lives === 1 ? (livesOverride ? "1 life" : "No Lives") : `${lives} lives`;
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
/** Scrambled: the word's letters shuffled, never left in their real order (when that's possible). */
function scrambleWord(word: string, random: () => number): string {
  if (new Set(word).size < 2) return word;
  for (let tries = 0; tries < 8; tries++) {
    const a = [...word];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    const out = a.join("");
    if (out !== word) return out;
  }
  return [...word].reverse().join("");
}

/** Marathon Mix: the twist's effects as short chips ("Points ×1.5", "Misses cost 2 lives"). */
function twistChips(t: (typeof MIX_TWISTS)[MixTwistId]): { text: string; bad: boolean }[] {
  const chips: { text: string; bad: boolean }[] = [];
  if (t.pointsFactor !== 1) chips.push({ text: `Points ×${t.pointsFactor}`, bad: t.pointsFactor < 1 });
  if (t.timeFactor !== 1)
    chips.push({
      text: t.timeFactor < 1 ? `${Math.round((1 - t.timeFactor) * 100)}% less time` : `${Math.round((t.timeFactor - 1) * 100)}% more time`,
      bad: t.timeFactor < 1,
    });
  if (t.missCost > 1) chips.push({ text: `Misses cost ${t.missCost} lives`, bad: true });
  if (t.bossHpFactor > 1) chips.push({ text: `Boss health ×${t.bossHpFactor}`, bad: true });
  if (t.lengths) chips.push({ text: `${t.lengths[0]}–${t.lengths[1]} letter words`, bad: true });
  if (t.backwards) chips.push({ text: "Words reversed", bad: true });
  if (t.vanish) chips.push({ text: "Words vanish", bad: true });
  if (t.masked) chips.push({ text: "Letters hidden", bad: true });
  if (t.scramble) chips.push({ text: "Letters jumbled", bad: true });
  if (t.shrinkPerWord) chips.push({ text: "Clock shrinks each word", bad: true });
  if (t.lockPowerUps) chips.push({ text: "Power-ups locked", bad: true });
  if (t.startShields) chips.push({ text: `+${t.startShields} free Shields`, bad: false });
  if (t.powerUpEvery) chips.push({ text: `Power-up every ${t.powerUpEvery} words`, bad: false });
  if (t.healOnFlawless) chips.push({ text: "Clean words heal", bad: false });
  if (!chips.length) chips.push({ text: "Normal rules", bad: false });
  return chips;
}

/** "2:05" */
function formatClock(seconds: number): string {
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** Zen: time spent typing, ticking on its own. */
function ZenTimer({ seconds, style }: { seconds: () => number; style: object }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), 500);
    return () => clearInterval(id);
  }, []);
  return <Text style={[style, { fontVariant: ["tabular-nums"] }]}>{formatClock(seconds())}</Text>;
}

function Remaining({ G, style }: { G: GameState; style: object }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), 100);
    return () => clearInterval(id);
  }, []);
  let remaining = G.limit;
  if (G.phase === "playing" && G.frozen) remaining = G.pausedRemaining * G.wordLimit;
  else if (G.phase === "playing" || (G.mode === "sprint" && G.phase === "between" && G.clockStarted))
    remaining = Math.max(0, G.wordLimit - (Date.now() - G.wordStart) / 1000);
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
    bossArmored: { borderWidth: 2, borderRadius: 8, padding: 4, gap: 4 },
    bossCrack: { position: "absolute", right: 0, top: 0, bottom: 0 },
    bossHpSeg: { flex: 1, maxWidth: 70, height: 10, borderRadius: 3, overflow: "hidden" },
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
    modeButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: 1.5,
      borderColor: c.accent,
      backgroundColor: c.accentSoft,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginTop: -6,
    },
    modeCard: { borderWidth: 1.5, borderColor: c.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 2 },
    towerCard: { borderWidth: 1.5, borderColor: c.line, borderRadius: 12, padding: 12, gap: 8 },
    towerTrack: { height: 10, borderRadius: 999, backgroundColor: c.bg, overflow: "hidden", justifyContent: "center" },
    towerFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 999 },
    towerMark: { position: "absolute", width: 2, height: 10, marginLeft: -2 },
    btnGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
    btnHalf: { width: "48.5%" },
    proBadge: {
      fontFamily: fonts.bodyStrong,
      fontSize: 10,
      letterSpacing: 1,
      color: c.onAccent,
      backgroundColor: c.gold,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 1,
      overflow: "hidden",
    },
    proLine: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -6 },
    proCta: { borderWidth: 1.5, borderColor: c.gold, borderRadius: 12, padding: 12, gap: 3, backgroundColor: c.surface },
    proPerk: { flexDirection: "row", alignItems: "center", gap: 10 },
    twistCard: { padding: 22, gap: 12, borderColor: c.gold, borderWidth: 1.5 },
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
