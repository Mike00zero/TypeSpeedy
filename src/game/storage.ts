import AsyncStorage from "@react-native-async-storage/async-storage";

const BEST = "typespeedy.best";
const MUTED = "typespeedy.muted";

export async function loadPrefs(): Promise<{ best: number; muted: boolean }> {
  try {
    const [b, m] = await Promise.all([AsyncStorage.getItem(BEST), AsyncStorage.getItem(MUTED)]);
    return { best: b ? Number(b) || 0 : 0, muted: m === "1" };
  } catch {
    return { best: 0, muted: false };
  }
}

export function saveBest(best: number) {
  AsyncStorage.setItem(BEST, String(best)).catch(() => {});
}

export function saveMuted(muted: boolean) {
  AsyncStorage.setItem(MUTED, muted ? "1" : "0").catch(() => {});
}
