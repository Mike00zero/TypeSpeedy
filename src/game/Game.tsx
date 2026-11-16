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
import { fonts, usePalette, type Palette } from "./theme";
import { initSounds, play, setMuted } from "./sound";
import { loadPrefs, saveBest, saveDifficulty, saveMuted, type BestScores } from "./storage";
import { useKeyboardHeight } from "./useKeyboardHeight";

type Phase = "title" | "banner" | "playing" | "between" | "paused" | "over";
type WordLook = "normal" | "solved" | "timedOut";
type Float = { id: number; text: string; kind: "good" | "bad"; x: number; anim: Animated.Value };

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
  limit: number;
  pausedRemaining: number; // fraction of the clock left when paused
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
    pausedRemaining: 1,
    keys: 0,
    goodKeys: 0,
    wordsTyped: 0,
    fastest: null,
    recent: [],
  };
}

export default function Game() {
  const { c, isDark } = usePalette();
  const s = styles(c);
  const insets = useSafeAreaInsets();
  const kbHeight = useKeyboardHeight();
  const { width } = useWindowDimensions();
  // Width of the play area, measured on layout; the screen width minus the side padding until then.
  const [stageWidth, setStageWidth] = useState(width - 36);
  // Each new word is first laid out off-screen at a reference size with no width limit, and its
  // real width is measured. The visible word is then sized from that measurement so it always fits,
  // and stays hidden until the measurement is in, so an overflow never shows.
  const [probe, setProbe] = useState<{ word: string; widthPerPx: number } | null>(null);
  // After that, the visible word itself is checked: `override` lowers its size if it still runs
  // past the edge, and `fitOk` records the size at which it was confirmed to fit.
  type SizeFor = { word: string; stageWidth: number; size: number };
  const [override, setOverride] = useState<SizeFor | null>(null);
  const [fitOk, setFitOk] = useState<SizeFor | null>(null);

  const G = useRef<GameState>(freshState(DIFFICULTIES.medium)).current;
  const [, setVersion] = useState(0);
  const bump = useCallback(() => setVersion(v => v + 1), []);
  const [best, setBest] = useState<BestScores>({ easy: 0, medium: 0, hard: 0, impossible: 0 });
  const bestRef = useRef<BestScores>(best);
  const [difficulty, setDifficulty] = useState<DifficultyId>("medium");
  const difficultyRef = useRef<DifficultyId>("medium");
  const [muted, setMutedState] = useState(false);
  const [floats, setFloats] = useState<Float[]>([]);
  const [isNewBest, setIsNewBest] = useState(false);

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
  const pips = useRef(Array.from({ length: MAX_LIVES }, () => new Animated.Value(1))).current;

  /* ---------- setup ---------- */
  useEffect(() => {
    initSounds();
    loadPrefs().then(p => {
      bestRef.current = p.best;
      setBest(p.best);
      setMutedState(p.muted);
      setMuted(p.muted);
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
      if (st !== "active") pause();
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
  const measured = () => (probe !== null && probe.word === G.word ? probe : null);
  const currentFontSize = () => {
    const m = measured();
    const len = G.word.length || 8;
    let size: number;
    if (!m) size = wordFontSize(len, stageWidth); // estimate, only used while hidden
    else {
      const usable = stageWidth - WORD_MARGIN - len * LETTER_PAD;
      size = Math.max(MIN_WORD_FONT, Math.min(MAX_WORD_FONT, Math.floor(usable / m.widthPerPx)));
    }
    // The on-screen check below can only lower the size further.
    const o = override;
    if (o && o.word === G.word && o.stageWidth === stageWidth) size = Math.min(size, o.size);
    return size;
  };

  // Second check, on the word actually shown: where does its last letter end?
  const onLastLetterLayout = (x: number, w: number, size: number) => {
    const contentWidth = x + w;
    const avail = stageWidth - WORD_MARGIN;
    if (contentWidth > avail + 0.5 && size > MIN_WORD_FONT) {
      const next = Math.max(MIN_WORD_FONT, Math.min(size - 1, Math.floor((size * avail) / contentWidth)));
      setOverride({ word: G.word, stageWidth, size: next });
    } else if (!(fitOk && fitOk.word === G.word && fitOk.size === size && fitOk.stageWidth === stageWidth)) {
      setFitOk({ word: G.word, stageWidth, size });
    }
  };
  const charWidth = () => {
    const m = measured();
    const size = currentFontSize();
    return (m ? (m.widthPerPx * size) / G.word.length : size * 0.6) + LETTER_PAD;
  };

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
      duration: fromFraction * G.limit * 1000,
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
    bump();
    later(nextWord, 1700);
  };

  const nextWord = () => {
    G.word = pickWord(G.d.lengths(G.round), G.recent);
    G.recent.push(G.word);
    if (G.recent.length > 40) G.recent.shift();
    G.pos = 0;
    G.wordMisses = 0;
    G.missed = new Set();
    G.wrongAt = null;
    G.look = "normal";
    G.wordId++;
    G.wordStart = Date.now();
    G.phase = "playing";
    resetInput();
    runClock(1);
    bump();
  };

  const advance = () => {
    G.wordInRound++;
    if (G.lives <= 0) return gameOver();
    if (G.wordInRound >= wordsInRound(G.round)) {
      G.round++;
      startRound();
    } else nextWord();
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
      G.wrongAt = G.pos;
      letterPop.setValue(1.35);
      Animated.spring(letterPop, { toValue: 1, friction: 4, useNativeDriver: true }).start();
      play("miss");
      addFloat(G.d.lives === 1 ? "Miss" : "−1 life", "bad", G.pos);
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
    const pts = scoreWord(G.round, used, G.limit, G.wordMisses);
    G.score += pts;
    G.wordsTyped++;
    if (!G.fastest || used < G.fastest.t) G.fastest = { t: used, w: G.word };
    G.phase = "between";
    G.look = "solved";
    fuse.stopAnimation();
    addFloat(`+${pts}${G.wordMisses === 0 ? " flawless" : ""}`, "good");
    play("word");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    bump();
    later(advance, 260);
  };

  const timedOut = () => {
    G.phase = "between";
    G.look = "timedOut";
    G.wrongAt = null;
    addFloat(G.d.lives === 1 ? "Too slow" : `Too slow · −${CONFIG.timeoutCost} life`, "bad");
    play("timeout");
    loseLife(CONFIG.timeoutCost);
    bump();
    later(advance, 650);
  };

  const gameOver = () => {
    if (G.phase === "over") return;
    G.phase = "over";
    fuse.stopAnimation();
    play("over");
    const id = G.d.id;
    const newBest = G.score > bestRef.current[id];
    if (newBest) {
      bestRef.current = { ...bestRef.current, [id]: G.score };
      setBest(bestRef.current);
      saveBest(id, G.score);
    }
    setIsNewBest(newBest && G.score > 0);
    Keyboard.dismiss();
    popOverlay();
    bump();
  };

  const pause = () => {
    if (G.phase !== "playing") return;
    fuse.stopAnimation(v => {
      G.pausedRemaining = v;
    });
    G.phase = "paused";
    popOverlay();
    bump();
  };

  const resume = () => {
    if (G.phase !== "paused") return;
    const elapsedFrac = 1 - G.pausedRemaining;
    G.wordStart = Date.now() - elapsedFrac * G.limit * 1000;
    G.phase = "playing";
    focusInput();
    runClock(G.pausedRemaining);
    bump();
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
    for (const ch of added) handleChar(ch);
    if (t.length > 40) resetInput();
  };
  const onSubmit = () => {
    if (G.phase === "title" || G.phase === "over") startGame();
    else if (G.phase === "paused") resume();
  };

  /* ---------- render ---------- */
  const total = wordsInRound(G.round);
  const oneLife = G.d.lives === 1;
  const low = !oneLife && G.lives > 0 && G.lives <= Math.ceil(G.d.lives * 0.3);
  const bestHere = best[G.d.id];
  const fontSize = currentFontSize();
  const wordReady =
    G.word === "" ||
    (measured() !== null &&
      fitOk !== null &&
      fitOk.word === G.word &&
      fitOk.size === fontSize &&
      fitOk.stageWidth === stageWidth);
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
      <StatusBar style={isDark ? "light" : "dark"} />

      {/* HUD */}
      <View style={s.hud}>
        <View style={s.stat}>
          <Text style={s.label}>SCORE</Text>
          <Text style={s.value}>{G.score.toLocaleString()}</Text>
          <Text style={s.meta}>
            {G.d.label} · Best {Math.max(bestHere, G.score).toLocaleString()}
          </Text>
        </View>
        <View style={[s.stat, { alignItems: "flex-end" }]}>
          <Text style={s.label}>ROUND</Text>
          <Text style={s.value}>{G.round}</Text>
          <Text style={s.meta}>
            word {Math.min(G.wordInRound + 1, total)} of {total}
          </Text>
        </View>
      </View>
      <View style={s.livesRow}>
        <Text style={[s.label, (low || oneLife) && { color: c.miss }]}>
          {oneLife ? "NO HEALTH · ONE MISS ENDS IT" : `LIVES ${G.lives}`}
        </Text>
        <View style={[s.pips, oneLife && { display: "none" }]}>
          {pips.slice(0, G.d.lives).map((p, i) => {
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
                { color: f.kind === "good" ? c.good : c.miss },
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
            key={`${G.wordId}-${G.word}`} // fresh layout (and fit check) for every word
            style={[s.word, { opacity: wordReady ? 1 : 0, transform: [{ translateX: shake }] }]}
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
              return (
                <Animated.View
                  key={i}
                  onLayout={
                    i === G.word.length - 1
                      ? e => onLastLetterLayout(e.nativeEvent.layout.x, e.nativeEvent.layout.width, fontSize)
                      : undefined
                  }
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
              Time per word <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{formatSeconds(G.limit)}</Text>
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

      <View style={s.controls}>
        <Pressable style={s.chip} onPress={() => (G.phase === "paused" ? resume() : pause())} hitSlop={8}>
          <Text style={s.chipText}>{G.phase === "paused" ? "RESUME" : "PAUSE"}</Text>
        </Pressable>
        <Pressable style={s.chip} onPress={toggleMute} hitSlop={8}>
          <Text style={s.chipText}>{muted ? "SOUND OFF" : "SOUND ON"}</Text>
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

      {/* Off-screen measuring copy of the word (see `probe`) */}
      <View style={s.probe} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text
          key={G.word}
          style={[s.letter, { fontSize: PROBE_FONT }]}
          allowFontScaling={false}
          numberOfLines={1}
          onLayout={e => {
            const w = e.nativeEvent.layout.width;
            if (w > 0) setProbe({ word: G.word, widthPerPx: w / PROBE_FONT });
          }}
        >
          {G.word}
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
          <Btn c={c} label={`Start ${G.d.label}`} onPress={startGame} />
        </Overlay>
      )}

      {G.phase === "banner" && (
        <View style={[StyleSheet.absoluteFill, s.bannerWrap]} pointerEvents="none">
          <Animated.View style={[s.banner, { transform: [{ scale: overlayPop }] }]}>
            <Text style={s.label}>ROUND</Text>
            <Text style={s.bannerBig}>{G.round}</Text>
            <Text style={s.bannerSub}>
              <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{total}</Text> words ·{" "}
              <Text style={{ color: c.ink, fontFamily: fonts.bodyStrong }}>{formatSeconds(G.limit)}</Text> per word
            </Text>
            {bannerNote ? <Text style={s.bannerNote}>{bannerNote}</Text> : null}
          </Animated.View>
        </View>
      )}

      {G.phase === "paused" && (
        <Overlay c={c} pop={overlayPop}>
          <Text style={s.eyebrow}>PAUSED</Text>
          <Text style={s.h2}>Take a breath</Text>
          <Text style={s.body}>The clock is stopped. Your word will be waiting.</Text>
          <Btn c={c} label="Resume" onPress={resume} />
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
          </Text>
          <Btn c={c} label="Play again" onPress={startGame} />
          <Btn c={c} label="Change difficulty" onPress={toTitle} secondary />
        </Overlay>
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
  const health = d.lives === 1 ? "No health" : `${d.lives} lives`;
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
        {formatSeconds(d.startTime)} → {formatSeconds(d.minTime)} · {health}
      </Text>
      <Text style={s.diffWords}>{d.words}</Text>
      {best > 0 ? <Text style={s.diffBest}>Best {best.toLocaleString()}</Text> : null}
    </Pressable>
  );
}

/* ---------- small components ---------- */

// IBM Plex Mono advances 0.6em per glyph; 0.62 leaves a little room for rounding.
const MONO_ADVANCE = 0.62;
const LETTER_PAD = 2; // letterBox paddingHorizontal, both sides
const WORD_MARGIN = 8; // breathing room so the shake doesn't touch the edges
const MIN_WORD_FONT = 10;
const MAX_WORD_FONT = 76;
const PROBE_FONT = 100; // reference size for measuring a word's width

/** Largest font size (up to 76) at which a word of `len` letters fits in `availWidth`. */
function wordFontSize(len: number, availWidth: number) {
  const usable = availWidth - WORD_MARGIN - len * LETTER_PAD;
  return Math.max(MIN_WORD_FONT, Math.min(MAX_WORD_FONT, Math.floor(usable / (len * MONO_ADVANCE))));
}

/** Seconds left on the clock, ticking on its own so the whole game doesn't re-render. */
function Remaining({ G, style }: { G: GameState; style: object }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT(t => t + 1), 100);
    return () => clearInterval(id);
  }, []);
  let remaining = G.limit;
  if (G.phase === "playing") remaining = Math.max(0, G.limit - (Date.now() - G.wordStart) / 1000);
  else if (G.phase === "paused") remaining = G.pausedRemaining * G.limit;
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
    hud: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
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
    float: { position: "absolute", top: -34, fontFamily: fonts.display, fontSize: 22 },

    fuse: { width: "100%", maxWidth: 560, gap: 8 },
    fuseTrack: { height: 10, borderRadius: 999, backgroundColor: c.line, overflow: "hidden" },
    fuseFill: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, borderRadius: 999, transformOrigin: "left" },
    fuseHot: {},
    fuseRow: { flexDirection: "row", justifyContent: "space-between" },
    hint: { fontFamily: fonts.body, fontSize: 13, color: c.muted, textAlign: "center" },

    controls: { flexDirection: "row", justifyContent: "center", gap: 10 },
    chip: { borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { fontFamily: fonts.bodyStrong, fontSize: 11, letterSpacing: 1, color: c.muted },

    hiddenInput: { position: "absolute", width: 1, height: 1, opacity: 0, left: -10, top: 0 },
    // Wide enough that no word is ever clipped; parked above the screen.
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
