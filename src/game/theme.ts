import { useColorScheme } from "react-native";

export type Palette = {
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  ghost: string;
  line: string;
  accent: string;
  accentSoft: string;
  onAccent: string;
  good: string;
  miss: string;
  missSoft: string;
  scrim: string;
  gold: string;
  ice: string;
  violet: string;
};

const light: Palette = {
  bg: "#EEF1F7",
  surface: "#FFFFFF",
  ink: "#131A2C",
  muted: "#59627A",
  ghost: "#A9B2C6",
  line: "#D6DCE8",
  accent: "#2A47F5",
  accentSoft: "rgba(42, 71, 245, 0.08)",
  onAccent: "#FFFFFF",
  good: "#0F8F68",
  miss: "#E3223A",
  missSoft: "rgba(227, 34, 58, 0.14)",
  scrim: "rgba(238, 241, 247, 0.9)",
  gold: "#B07612",
  ice: "#0B87AE",
  violet: "#7A3FE0",
};

const dark: Palette = {
  bg: "#0C1020",
  surface: "#151A2D",
  ink: "#ECEFF8",
  muted: "#8E97AF",
  ghost: "#475069",
  line: "#262D45",
  accent: "#7D93FF",
  accentSoft: "rgba(125, 147, 255, 0.12)",
  onAccent: "#0C1020",
  good: "#3BD39E",
  miss: "#FF4A5C",
  missSoft: "rgba(255, 74, 92, 0.18)",
  scrim: "rgba(12, 16, 32, 0.9)",
  gold: "#F2C14E",
  ice: "#5CC8EC",
  violet: "#B595FF",
};

/** Boss fights: one dark ember-and-crimson look, whatever the system theme. */
export const bossPalette: Palette = {
  bg: "#12060A",
  surface: "#1E0B11",
  ink: "#F7E8EA",
  muted: "#B48A93",
  ghost: "#5C3741",
  line: "#3B1A22",
  accent: "#FF7A2F",
  accentSoft: "rgba(255, 122, 47, 0.14)",
  onAccent: "#12060A",
  good: "#FFB547",
  miss: "#FF3355",
  missSoft: "rgba(255, 51, 85, 0.2)",
  scrim: "rgba(18, 6, 10, 0.92)",
  gold: "#F2C14E",
  ice: "#5CC8EC",
  violet: "#C9A8FF",
};

/**
 * "Royal Court": the game's default look since the redesign. Dark stone, gold trim, parchment
 * text and carved serif titles. (Shapes and fonts for it live in Game.tsx's styles; see `getLook`.)
 */
const court: Palette = {
  bg: "#120C10",
  surface: "#1E1418",
  ink: "#F3E6CF",
  muted: "#B8A58A",
  ghost: "#5C4A44",
  line: "#3A2A22",
  accent: "#E8C068",
  accentSoft: "rgba(232, 192, 104, 0.12)",
  onAccent: "#1A1008",
  good: "#7FD39A",
  miss: "#FF5A6E",
  missSoft: "rgba(255, 90, 110, 0.18)",
  scrim: "rgba(18, 12, 16, 0.93)",
  gold: "#E8C068",
  ice: "#5CC8EC",
  violet: "#C9A8FF",
};

/**
 * The overall look. "court" (default) restyles every screen: serif titles, gold trim, squarer
 * corners, shield-shaped lives. "modern" is the original clean design (Settings > Look).
 */
export type Look = "court" | "modern";
let look: Look = "court";
export function setLook(l: Look) {
  look = l;
}
export function getLook(): Look {
  return look;
}

/** "#E8C068" + 0.45 -> "#E8C06873" (other color formats come back unchanged). */
export function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return color + Math.round(alpha * 255).toString(16).padStart(2, "0");
}

/** The Classic theme's two looks (it follows the phone's light or dark mode). */
export const lightPalette = light;
export const courtPalette = court;
export const darkPalette = dark;

/** Fonts for the Royal Court look: Cinzel for titles and labels, the same word and body fonts. */
export const courtFonts = {
  display: "Cinzel_800ExtraBold",
  displayMedium: "Cinzel_600SemiBold",
  word: "IBMPlexMono_600SemiBold",
  body: "Inter_400Regular",
  bodyStrong: "Inter_600SemiBold",
};

export const fonts = {
  display: "BricolageGrotesque_800ExtraBold",
  displayMedium: "BricolageGrotesque_500Medium",
  word: "IBMPlexMono_600SemiBold",
  body: "Inter_400Regular",
  bodyStrong: "Inter_600SemiBold",
};

export function usePalette(): { c: Palette; isDark: boolean } {
  const isDark = useColorScheme() === "dark";
  return { c: isDark ? dark : light, isDark };
}
