/**
 * The Royal Court look's own screens and pieces: the main menu, shield lives and icons.
 * Built to match the "Tyrant's Court" design comps. (The Modern look uses Game.tsx's originals.)
 */
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import type { GameMode } from "./modes";
import { courtFonts as F, withAlpha, type Palette } from "./theme";

/* ---------- icons ---------- */

export function GearIcon({ color, size = 20 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" />
    </Svg>
  );
}

export function PauseIcon({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="6" y="4" width="4" height="16" rx="1" fill={color} />
      <Rect x="14" y="4" width="4" height="16" rx="1" fill={color} />
    </Svg>
  );
}

/** A shield, for lives. */
export function ShieldIcon({ fill, stroke, size = 26 }: { fill: string; stroke: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill={fill} stroke={stroke} strokeWidth={1.5} />
    </Svg>
  );
}

function ScrollIcon({ c }: { c: Palette }) {
  return (
    <Svg width={34} height={40} viewBox="0 0 34 40">
      <Path d="M4 2h22l4 4v32H4z" fill={c.ink} />
      <Path d="M9 12h16M9 18h16M9 24h10" stroke="#8C6A24" strokeWidth={2} />
      <Circle cx="24" cy="32" r="5" fill="#C8243B" />
    </Svg>
  );
}

/** Each mode's emblem on the quest card. */
export function ModeIcon({ mode, c }: { mode: GameMode; c: Palette }) {
  const gold = c.gold;
  const dark = c.line;
  switch (mode) {
    case "tower":
      return (
        <Svg width={44} height={60} viewBox="0 0 44 60">
          <Path d="M10 58V18h24v40z" fill={dark} stroke={gold} strokeWidth={2} />
          <Path d="M8 18V10h5v4h5v-4h8v4h5v-4h5v8z" fill={gold} />
          <Rect x="18" y="44" width="8" height="14" fill={c.bg} />
          <Rect x="18" y="26" width="8" height="8" fill={gold} />
        </Svg>
      );
    case "classic":
      return (
        <Svg width={44} height={60} viewBox="0 0 44 60">
          <Path d="M22 6l16 6v14c0 12-7 21-16 26C13 47 6 38 6 26V12z" fill={dark} stroke={gold} strokeWidth={2} />
          <Path d="M22 16v26M14 26h16" stroke={gold} strokeWidth={3} strokeLinecap="round" />
        </Svg>
      );
    case "sudden":
      return (
        <Svg width={44} height={60} viewBox="0 0 44 60">
          <Path d="M22 8c9 0 15 6 15 15 0 6-3 10-7 12v7H14v-7c-4-2-7-6-7-12 0-9 6-15 15-15z" fill={dark} stroke={gold} strokeWidth={2} />
          <Circle cx="16" cy="24" r="4" fill="#C8243B" />
          <Circle cx="28" cy="24" r="4" fill="#C8243B" />
          <Path d="M18 42v6M22 42v6M26 42v6" stroke={gold} strokeWidth={2} />
        </Svg>
      );
    case "rush":
      return (
        <Svg width={44} height={60} viewBox="0 0 44 60">
          <Path d="M8 12l26 30M36 12L10 42" stroke={gold} strokeWidth={4} strokeLinecap="round" />
          <Path d="M28 44l8-8M8 36l8 8" stroke="#C8243B" strokeWidth={4} strokeLinecap="round" />
        </Svg>
      );
    case "sprint":
      return (
        <Svg width={44} height={60} viewBox="0 0 44 60">
          <Path d="M10 8h24M10 52h24M12 8c0 12 20 12 20 22S12 40 12 52M32 8c0 12-20 12-20 22s20 10 20 22" fill="none" stroke={gold} strokeWidth={2.5} />
          <Path d="M16 48c2-5 10-5 12 0z" fill="#C8243B" />
        </Svg>
      );
    case "zen":
      return (
        <Svg width={44} height={60} viewBox="0 0 44 60">
          <Path d="M22 14c6 8 6 18 0 28-6-10-6-20 0-28z" fill={dark} stroke={gold} strokeWidth={2} />
          <Path d="M22 42c-8-2-14-8-16-16 8 1 13 6 16 16zM22 42c8-2 14-8 16-16-8 1-13 6-16 16z" fill={dark} stroke={gold} strokeWidth={2} />
        </Svg>
      );
    case "mix":
      return (
        <Svg width={44} height={60} viewBox="0 0 44 60">
          <Rect x="6" y="14" width="22" height="22" rx="4" fill={dark} stroke={gold} strokeWidth={2} />
          <Rect x="18" y="26" width="22" height="22" rx="4" fill={dark} stroke={gold} strokeWidth={2} />
          <Circle cx="13" cy="21" r="2.5" fill={gold} />
          <Circle cx="21" cy="29" r="2.5" fill={gold} />
          <Circle cx="25" cy="33" r="2.5" fill="#C8243B" />
          <Circle cx="33" cy="41" r="2.5" fill="#C8243B" />
        </Svg>
      );
  }
}

/* ---------- main menu ---------- */

export type CourtMenuProps = {
  c: Palette;
  topInset: number;
  bottomInset: number;
  onSettings: () => void;
  daily: { eyebrow: string; title: string; detail: string; done: boolean; onPlay: () => void };
  mode: GameMode;
  quest: {
    name: string;
    tagline: string;
    detail?: string; // a line under the progress bar or pills
    progress?: number; // 0..1, shows a bar (Tower)
    proNote?: string; // free-try note for Pro quests
  };
  onChangeMode: () => void;
  onProNote: () => void;
  difficulties?: { id: string; label: string; selected: boolean; onPress: () => void }[];
  startLabel: string;
  onStart: () => void;
  trophies: string;
  onCodex: () => void;
  onChronicle: () => void;
  onTrophies: () => void;
  onArmory: () => void;
  royalPass: { show: boolean; price: string; onPress: () => void };
};

export function CourtMenu(p: CourtMenuProps) {
  const { c } = p;
  const s = courtStyles(c);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
      <ScrollView
        contentContainerStyle={[s.menu, { paddingTop: p.topInset + 8, paddingBottom: p.bottomInset + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={s.topRow}>
          <Pressable onPress={p.onSettings} style={s.roundBtn} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={6}>
            <GearIcon color={c.gold} />
          </Pressable>
        </View>

        <View style={s.header}>
          <Image source={require("../../assets/crown.png")} style={s.crown} accessibilityIgnoresInvertColors />
          <Text style={s.title} accessibilityRole="header">
            TYPO{"\n"}TYRANT
          </Text>
          <View style={s.divider}>
            <View style={s.rule} />
            <Text style={s.tagline}>SPELL TO SURVIVE</Text>
            <View style={s.rule} />
          </View>
          <Text style={s.about}>
            Type each word before the clock runs out. Wrong letters cost lives, every round gets faster, and a boss waits at
            the end of each one. How long can you last?
          </Text>
        </View>

        <Pressable
          onPress={p.daily.onPlay}
          disabled={p.daily.done}
          style={({ pressed }) => [s.decree, p.daily.done && { opacity: 0.85 }, pressed && { transform: [{ scale: 0.98 }] }]}
          accessibilityRole="button"
          accessibilityLabel={`${p.daily.eyebrow}. ${p.daily.title}. ${p.daily.detail}`}
        >
          <View style={s.decreeInner}>
            <ScrollIcon c={c} />
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={s.decreeEyebrow}>{p.daily.eyebrow}</Text>
              <Text style={s.decreeTitle}>{p.daily.title}</Text>
              <Text style={s.small}>{p.daily.detail}</Text>
            </View>
          </View>
        </Pressable>

        <View style={{ gap: 8 }}>
          <Text style={s.section}>CHOOSE YOUR QUEST</Text>
          <View style={s.quest}>
            <ModeIcon mode={p.mode} c={c} />
            <View style={{ flex: 1, gap: 6 }}>
              <View style={s.questHead}>
                <Text style={s.questName}>{p.quest.name}</Text>
                <Pressable onPress={p.onChangeMode} hitSlop={12} accessibilityRole="button" accessibilityLabel="Change quest">
                  <Text style={s.change}>CHANGE</Text>
                </Pressable>
              </View>
              <Text style={s.small}>{p.quest.tagline}</Text>
              {p.quest.progress !== undefined && (
                <View style={s.progressTrack}>
                  <View style={[s.progressFill, { width: `${Math.round(p.quest.progress * 100)}%` }]} />
                </View>
              )}
              {p.difficulties && (
                <View style={s.pills} accessibilityRole="radiogroup">
                  {p.difficulties.map(d => (
                    <Pressable
                      key={d.id}
                      onPress={d.onPress}
                      style={[s.pill, d.selected && s.pillOn]}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: d.selected }}
                    >
                      <Text style={[s.pillText, d.selected && { color: c.onAccent }]}>{d.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              {p.quest.detail ? <Text style={s.tiny}>{p.quest.detail}</Text> : null}
              {p.quest.proNote ? (
                <Pressable onPress={p.onProNote} accessibilityRole="button">
                  <Text style={[s.tiny, { color: c.gold }]}>{p.quest.proNote}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        <Pressable
          onPress={p.onStart}
          style={({ pressed }) => [s.start, pressed && { transform: [{ translateY: 3 }], borderBottomWidth: 3 }]}
          accessibilityRole="button"
        >
          <View style={s.startInner}>
            <Text style={s.startText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {p.startLabel.toUpperCase()}
            </Text>
          </View>
        </Pressable>

        <View style={s.grid}>
          {[
            ["Codex", p.onCodex],
            ["Chronicle", p.onChronicle],
            [p.trophies, p.onTrophies],
            ["Armory", p.onArmory],
          ].map(([label, onPress]) => (
            <Pressable
              key={label as string}
              onPress={onPress as () => void}
              style={({ pressed }) => [s.gridBtn, pressed && { opacity: 0.8 }]}
              accessibilityRole="button"
            >
              <Text style={s.gridText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {label as string}
              </Text>
            </Pressable>
          ))}
        </View>

        {p.royalPass.show && (
          <Pressable onPress={p.royalPass.onPress} style={s.pass} accessibilityRole="button">
            <Text style={s.passName}>Royal Pass</Text>
            <Text style={s.small}>· every quest unlocked · {p.royalPass.price}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/** Lives as shields (lost ones go dark). */
export function CourtLives({ c, lives, max, low }: { c: Palette; lives: number; max: number; low: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "center", gap: max > 6 ? 4 : 8 }} accessibilityLabel={`Lives: ${lives} of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <ShieldIcon
          key={i}
          size={max > 6 ? 22 : 26}
          fill={i < lives ? (low ? c.miss : "#C8243B") : c.line}
          stroke={i < lives ? c.gold : c.ghost}
        />
      ))}
    </View>
  );
}

/* ---------- styles ---------- */

const cache = new Map<Palette, ReturnType<typeof make>>();
export function courtStyles(c: Palette) {
  let v = cache.get(c);
  if (!v) cache.set(c, (v = make(c)));
  return v;
}

function make(c: Palette) {
  const trim = withAlpha(c.gold, 0.45); // gold trim, in this theme's gold
  return StyleSheet.create({
    // Centered column, so the menu stays phone-shaped on an iPad.
    menu: { paddingHorizontal: 20, gap: 16, flexGrow: 1, width: "100%", maxWidth: 520, alignSelf: "center" },
    topRow: { flexDirection: "row", justifyContent: "flex-end" },
    roundBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: trim,
      alignItems: "center",
      justifyContent: "center",
    },
    header: { alignItems: "center", gap: 6, marginTop: -12 },
    crown: { width: 72, height: 44, resizeMode: "contain" },
    title: { fontFamily: F.display, fontSize: 40, lineHeight: 44, letterSpacing: 2, color: c.gold, textAlign: "center" },
    divider: { flexDirection: "row", alignItems: "center", gap: 10, alignSelf: "stretch" },
    rule: { flex: 1, height: 1, backgroundColor: trim },
    tagline: { fontFamily: F.displayMedium, fontSize: 12, letterSpacing: 3, color: c.muted },
    about: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: c.muted, textAlign: "center", marginTop: 6, paddingHorizontal: 4 },

    decree: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.gold, borderRadius: 6, padding: 3 },
    decreeInner: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      borderWidth: 1,
      borderColor: trim,
      borderRadius: 4,
      paddingHorizontal: 11,
      paddingVertical: 9,
    },
    decreeEyebrow: { fontFamily: F.displayMedium, fontSize: 11, letterSpacing: 2, color: c.gold },
    decreeTitle: { fontFamily: F.bodyStrong, fontSize: 17, color: c.ink },
    small: { fontFamily: F.body, fontSize: 12, color: c.muted },
    tiny: { fontFamily: F.body, fontSize: 11, color: c.muted },

    section: { fontFamily: F.displayMedium, fontSize: 11, letterSpacing: 2, color: c.muted },
    quest: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.gold,
      borderRadius: 6,
      padding: 14,
      flexDirection: "row",
      gap: 14,
      alignItems: "center",
    },
    questHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    questName: { fontFamily: F.display, fontSize: 18, color: c.ink },
    change: { fontFamily: F.bodyStrong, fontSize: 11, color: c.gold },
    progressTrack: { height: 8, backgroundColor: c.bg, borderWidth: 1, borderColor: trim, borderRadius: 4, overflow: "hidden" },
    progressFill: { height: "100%", backgroundColor: c.gold },
    pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    pill: { borderWidth: 1, borderColor: trim, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 5 },
    pillOn: { backgroundColor: c.gold, borderColor: c.gold },
    pillText: { fontFamily: F.displayMedium, fontSize: 11, color: c.ink },

    start: {
      backgroundColor: c.gold,
      borderWidth: 1,
      borderColor: "rgba(0, 0, 0, 0.3)",
      borderRadius: 6,
      borderBottomWidth: 6,
      borderBottomColor: "rgba(0, 0, 0, 0.45)",
      padding: 3,
    },
    startInner: { borderWidth: 1, borderColor: "rgba(0, 0, 0, 0.3)", borderRadius: 4, paddingVertical: 13, alignItems: "center", paddingHorizontal: 10 },
    startText: { fontFamily: F.display, fontSize: 18, letterSpacing: 2, color: "#1A1008" },

    grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 10 },
    gridBtn: {
      width: "48.5%",
      minHeight: 48,
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: trim,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    gridText: { fontFamily: F.displayMedium, fontSize: 14, color: c.ink },

    pass: {
      marginTop: "auto",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.line,
    },
    passName: { fontFamily: F.displayMedium, fontSize: 13, color: c.gold },
  });
}
