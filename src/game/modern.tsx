/**
 * The Modern look ("Royal Throne"): the same medieval world as Retro, rendered like a modern
 * console UI. Glowing backdrop, frosted-glass panels, a row of big mode tiles, round icon buttons.
 * (The Retro look's screens live in court.tsx.)
 */
import { useEffect, useRef, type ComponentRef } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Circle, Defs, Path, RadialGradient, Rect, Stop, Text as SvgText } from "react-native-svg";

import { ModeIcon } from "./court";
import type { GameMode } from "./modes";
import type { PowerUpId } from "./powerups";
import { fonts as F, type Palette } from "./theme";

/* ---------- backdrop: soft colored light behind everything ---------- */

/** Three soft glows (warm top, violet right, crimson left) over the theme's background color. */
export function ModernBackdrop({ c }: { c: Palette }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: c.bg }]}>
      <Svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <Defs>
          <RadialGradient id="mbA" cx="50" cy="14" r="45" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={c.accent} stopOpacity={0.3} />
            <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="mbB" cx="92" cy="40" r="45" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={c.violet} stopOpacity={0.22} />
            <Stop offset="1" stopColor={c.violet} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="mbC" cx="6" cy="72" r="45" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={c.miss} stopOpacity={0.16} />
            <Stop offset="1" stopColor={c.miss} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill="url(#mbA)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#mbB)" />
        <Rect x="0" y="0" width="100" height="100" fill="url(#mbC)" />
      </Svg>
    </View>
  );
}

/* ---------- icons ---------- */

type IconName = "help" | "stats" | "trophy" | "palette" | "gear" | "pause";

export function UiIcon({ name, color, size = 18 }: { name: IconName; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === "help" && (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01" {...p} />
        </>
      )}
      {name === "stats" && <Path d="M5 20V10M12 20V4M19 20v-7" {...p} />}
      {name === "trophy" && <Path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4" {...p} />}
      {name === "palette" && (
        <>
          <Path d="M12 3a9 9 0 100 18c1 0 1.5-.8 1.5-1.6 0-1.3 1-2.1 2.2-2.1H18a3 3 0 003-3A9 9 0 0012 3z" {...p} />
          <Circle cx="7.5" cy="11" r="1" fill={color} />
          <Circle cx="12" cy="7.5" r="1" fill={color} />
          <Circle cx="16.5" cy="11" r="1" fill={color} />
        </>
      )}
      {name === "gear" && (
        <>
          <Circle cx="12" cy="12" r="3" {...p} />
          <Path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" {...p} />
        </>
      )}
      {name === "pause" && (
        <>
          <Rect x="6" y="4" width="4" height="16" rx="2" fill={color} />
          <Rect x="14" y="4" width="4" height="16" rx="2" fill={color} />
        </>
      )}
    </Svg>
  );
}

/** A glyph for each power-up (and "bonus" for the gold bonus). */
export function PowerUpGlyph({ id, color, size = 20 }: { id: PowerUpId | "bonus"; color: string; size?: number }) {
  const p = { stroke: color, strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, fill: "none" };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {id === "life" && <Path d="M12 20C6 15 3 12 3 8.5a4.5 4.5 0 019-1 4.5 4.5 0 019 1C21 12 18 15 12 20z" fill={color} />}
      {id === "refill" && (
        <>
          <Circle cx="12" cy="13" r="8" {...p} />
          <Path d="M12 9v4l3 2M9 2h6" {...p} />
        </>
      )}
      {id === "skip" && <Path d="M5 5l8 7-8 7zM15 5v14" {...p} fill={color} />}
      {id === "slow" && <Path d="M7 3h10M7 21h10M8 3c0 5 8 6 8 9s-8 4-8 9M16 3c0 5-8 6-8 9s8 4 8 9" {...p} />}
      {id === "shield" && <Path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" {...p} />}
      {id === "freeze" && <Path d="M12 2v20M4 6l16 12M20 6L4 18" {...p} />}
      {id === "double" && (
        <SvgText x="12" y="16.5" fontSize="12" fontWeight="bold" fill={color} textAnchor="middle">
          2×
        </SvgText>
      )}
      {id === "bonus" && <Path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" fill={color} />}
    </Svg>
  );
}

/* ---------- main menu ---------- */

/** Each mode's tile colors (top-left to bottom-right). */
export const TILE_COLORS: Record<GameMode | "daily", [string, string]> = {
  daily: ["#FF5C7A", "#78184A"],
  classic: ["#FF8A5B", "#82283C"],
  tower: ["#FFC861", "#B25C1A"],
  sprint: ["#5BD6FF", "#1C4E8A"],
  zen: ["#7BE0A6", "#1F5E58"],
  rush: ["#A86CFF", "#401E78"],
  sudden: ["#FF4F7B", "#4A0A24"],
  mix: ["#FFB04D", "#7A2E5E"],
};

export type ModeTile = {
  key: GameMode | "daily";
  title: string; // may contain "\n"
  badge?: string; // e.g. "TODAY", "PRO", "DONE"
  selected: boolean;
  onPress: () => void;
};

export type ModernMenuProps = {
  c: Palette;
  topInset: number;
  bottomInset: number;
  streak: string; // "4-day streak" or ""
  onSettings: () => void;
  tiles: ModeTile[];
  quest: { name: string; tagline: string; right?: string; detail?: string; progress?: number; proNote?: string };
  difficulties?: { id: string; label: string; selected: boolean; onPress: () => void }[];
  onProNote: () => void;
  startLabel: string;
  onStart: () => void;
  trophies: string;
  onHelp: () => void;
  onStats: () => void;
  onTrophies: () => void;
  onCustomize: () => void;
  royalPass: { show: boolean; price: string; onPress: () => void };
};

/** A palette that draws ModeIcon in white for the colored tiles. */
const WHITE_ICON = { gold: "#FFFFFF", line: "rgba(255,255,255,0.28)", bg: "rgba(0,0,0,0.28)" } as Palette;

export function ModernMenu(p: ModernMenuProps) {
  const { c } = p;
  const s = modernStyles(c);
  // Keep the selected quest tile in view (it may be off to the right, e.g. after picking from Settings).
  const rowRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const tileX = useRef<Record<string, number>>({});
  const firstScroll = useRef(true);
  const selectedKey = p.tiles.find(t => t.selected)?.key;
  const revealSelected = () => {
    const x = selectedKey ? tileX.current[selectedKey] : undefined;
    if (x === undefined) return;
    rowRef.current?.scrollTo({ x: Math.max(0, x - 40), animated: !firstScroll.current });
    firstScroll.current = false;
  };
  useEffect(revealSelected, [selectedKey]);
  return (
    <View style={StyleSheet.absoluteFill}>
      <ModernBackdrop c={c} />
      <ScrollView
        contentContainerStyle={[s.menu, { paddingTop: p.topInset + 8, paddingBottom: p.bottomInset + 16 }]}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={[s.row, s.pad]}>
          {p.streak ? (
            <View style={s.chip}>
              <Text style={[s.chipText, { color: c.gold }]}>{p.streak}</Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable onPress={p.onSettings} style={s.roundSmall} accessibilityRole="button" accessibilityLabel="Settings" hitSlop={6}>
            <UiIcon name="gear" color={c.ink} />
          </Pressable>
        </View>

        {/* Spare height (tall phones, iPad) splits above and below the menu, keeping it centered */}
        <View style={s.grow} />

        <View style={[s.hero, s.pad]}>
          <View style={s.crownWrap}>
            {/* Soft round glow behind the crown. (A shadow on the image itself draws as a box on iOS.) */}
            <Svg style={StyleSheet.absoluteFill} viewBox="0 0 160 120" pointerEvents="none">
              <Defs>
                <RadialGradient id="crownGlow" cx="80" cy="60" r="58" gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={c.accent} stopOpacity={0.45} />
                  <Stop offset="0.5" stopColor={c.accent} stopOpacity={0.14} />
                  <Stop offset="1" stopColor={c.accent} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Rect x="0" y="0" width="160" height="120" fill="url(#crownGlow)" />
            </Svg>
            <Image source={require("../../assets/crown.png")} style={s.crown} accessibilityIgnoresInvertColors />
          </View>
          <Text style={s.title} accessibilityRole="header">
            Typo Tyrant
          </Text>
          <Text style={s.tagline}>SPELL TO SURVIVE</Text>
          <Text style={s.about}>
            Type each word before the clock runs out. Wrong letters cost lives, every round gets faster, and a boss waits at
            the end of each one. How long can you last?
          </Text>
        </View>

        <View style={{ gap: 8 }}>
          <Text style={[s.section, s.pad]}>CHOOSE YOUR QUEST</Text>
          <ScrollView ref={rowRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tiles}>
            {p.tiles.map(t => (
              <Pressable
                key={t.key}
                onPress={t.onPress}
                onLayout={e => {
                  tileX.current[t.key] = e.nativeEvent.layout.x;
                  if (t.selected && firstScroll.current) revealSelected();
                }}
                style={({ pressed }) => [s.tileWrap, t.selected && s.tileSelected, pressed && { transform: [{ scale: 0.97 }] }]}
                accessibilityRole="button"
                accessibilityState={{ selected: t.selected }}
                accessibilityLabel={`${t.title.replace("\n", " ")}${t.badge ? `, ${t.badge}` : ""}`}
              >
                <LinearGradient
                  colors={TILE_COLORS[t.key]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={[s.tile, t.selected && s.tileBig]}
                >
                  <View style={s.tileTop}>
                    {t.key === "daily" ? (
                      <View />
                    ) : (
                      <View style={{ transform: [{ scale: 0.62 }], marginLeft: -8, marginTop: -10 }}>
                        <ModeIcon mode={t.key} c={WHITE_ICON} />
                      </View>
                    )}
                    {t.badge ? (
                      <View style={s.badge}>
                        <Text style={s.badgeText}>{t.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[s.tileTitle, t.selected && { fontSize: 18, lineHeight: 21 }]}>{t.title}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={[s.glass, s.quest, s.mx]}>
          <View style={s.row}>
            <Text style={s.questName}>{p.quest.name}</Text>
            {p.quest.right ? <Text style={[s.small, { color: c.gold }]}>{p.quest.right}</Text> : null}
          </View>
          <Text style={s.small}>{p.quest.tagline}</Text>
          {p.quest.progress !== undefined && (
            <View style={s.track}>
              <LinearGradient
                colors={["#FF8A5B", c.gold]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.fill, { width: `${Math.max(2, Math.round(p.quest.progress * 100))}%` }]}
              />
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

        <Pressable onPress={p.onStart} style={({ pressed }) => [s.mx, s.startShadow, pressed && { transform: [{ scale: 0.98 }] }]} accessibilityRole="button">
          <LinearGradient colors={["#FFE29A", "#F2AE3C"]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={s.start}>
            <Text style={s.startText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {p.startLabel}
            </Text>
          </LinearGradient>
        </Pressable>

        <View style={[s.iconRow, s.pad]}>
          {(
            [
              ["help", "How to play", p.onHelp],
              ["stats", "Stats", p.onStats],
              ["trophy", p.trophies, p.onTrophies],
              ["palette", "Customize", p.onCustomize],
            ] as [IconName, string, () => void][]
          ).map(([icon, label, onPress]) => (
            <Pressable key={icon} onPress={onPress} style={s.iconBtn} accessibilityRole="button" accessibilityLabel={label}>
              <View style={s.round}>
                <UiIcon name={icon} color={c.gold} />
              </View>
              <Text style={s.iconLabel} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={s.grow} />

        {p.royalPass.show && (
          <Pressable onPress={p.royalPass.onPress} style={s.pass} accessibilityRole="button">
            <Text style={[s.small, { color: c.gold, fontFamily: F.displayMedium }]}>Typo Tyrant Pro</Text>
            <Text style={s.small}>· every quest · {p.royalPass.price}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

/* ---------- styles ---------- */

const cache = new Map<Palette, ReturnType<typeof make>>();
export function modernStyles(c: Palette) {
  let v = cache.get(c);
  if (!v) cache.set(c, (v = make(c)));
  return v;
}

function make(c: Palette) {
  const glass = { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line };
  return StyleSheet.create({
    menu: { gap: 16, flexGrow: 1, width: "100%", maxWidth: 560, alignSelf: "center" },
    pad: { paddingHorizontal: 20 },
    mx: { marginHorizontal: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    glass,
    chip: { ...glass, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
    chipText: { fontFamily: F.bodyStrong, fontSize: 12 },
    roundSmall: { ...glass, width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
    round: { ...glass, width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },

    hero: { alignItems: "center", gap: 6, marginTop: -8 },
    crownWrap: { width: 160, height: 120, alignItems: "center", justifyContent: "center", marginVertical: -30 },
    crown: { width: 84, height: 52, resizeMode: "contain" },
    title: {
      fontFamily: F.display,
      fontSize: 44,
      lineHeight: 50,
      letterSpacing: -0.5,
      color: c.gold,
      textShadowColor: "rgba(255, 190, 90, 0.55)",
      textShadowRadius: 18,
    },
    tagline: { fontFamily: F.displayMedium, fontSize: 11, letterSpacing: 4, color: c.muted },
    about: { fontFamily: F.body, fontSize: 14, lineHeight: 20, color: c.muted, textAlign: "center", marginTop: 2 },
    section: { fontFamily: F.bodyStrong, fontSize: 11, letterSpacing: 1.5, color: c.muted },

    tiles: { paddingHorizontal: 20, paddingVertical: 14, gap: 14, alignItems: "flex-end" },
    tileWrap: {
      borderRadius: 22,
      shadowColor: "#000",
      shadowOpacity: 0.4,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
    tileSelected: {
      borderWidth: 2,
      borderColor: c.gold,
      padding: 3,
      borderRadius: 25,
      shadowColor: c.gold,
      shadowOpacity: 0.6,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 0 },
    },
    tile: {
      width: 112,
      height: 150,
      borderRadius: 20,
      padding: 12,
      justifyContent: "space-between",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.16)",
      overflow: "hidden",
    },
    tileBig: { width: 128, height: 166, borderRadius: 20 },
    tileTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", height: 40 },
    tileTitle: {
      fontFamily: F.display,
      fontSize: 16,
      lineHeight: 19,
      color: "#FFFFFF",
      textShadowColor: "rgba(0,0,0,0.35)",
      textShadowRadius: 6,
    },
    badge: { backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontFamily: F.bodyStrong, fontSize: 9, letterSpacing: 1, color: "#FFFFFF" },

    quest: { borderRadius: 20, padding: 14, gap: 6 },
    questName: { fontFamily: F.display, fontSize: 22, color: c.ink },
    small: { fontFamily: F.body, fontSize: 13, color: c.muted },
    tiny: { fontFamily: F.body, fontSize: 11, color: c.muted },
    track: { height: 6, borderRadius: 3, backgroundColor: c.line, overflow: "hidden", marginTop: 2 },
    fill: { height: "100%", borderRadius: 3 },
    pills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
    pill: { ...glass, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
    pillOn: { backgroundColor: c.gold, borderColor: c.gold },
    pillText: { fontFamily: F.bodyStrong, fontSize: 12, color: c.ink },

    startShadow: {
      borderRadius: 999,
      shadowColor: c.accent,
      shadowOpacity: 0.45,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 6,
    },
    start: { borderRadius: 999, paddingVertical: 17, alignItems: "center", paddingHorizontal: 16 },
    startText: { fontFamily: F.display, fontSize: 18, color: "#2A1606" },

    iconRow: { flexDirection: "row", justifyContent: "space-between" },
    iconBtn: { alignItems: "center", gap: 6, width: "24%" },
    iconLabel: { fontFamily: F.bodyStrong, fontSize: 11, color: c.muted },

    grow: { flexGrow: 1, marginVertical: -8 }, // cancels the extra 16pt row gap the spacer adds
    pass: { flexDirection: "row", justifyContent: "center", gap: 6, paddingTop: 4 },
  });
}
