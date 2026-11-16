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
