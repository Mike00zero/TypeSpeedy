import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { BricolageGrotesque_500Medium, BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";
import { IBMPlexMono_600SemiBold } from "@expo-google-fonts/ibm-plex-mono";
import { Inter_400Regular, Inter_600SemiBold } from "@expo-google-fonts/inter";
import { Cinzel_600SemiBold, Cinzel_800ExtraBold } from "@expo-google-fonts/cinzel";

import Game from "./src/game/Game";
import { ErrorBoundary } from "./src/game/ErrorBoundary";

// Keep the Typo Tyrant splash up until the game's fonts are ready, then fade it out.
SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({ duration: 400, fade: true });

export default function App() {
  const [loaded, error] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_800ExtraBold,
    IBMPlexMono_600SemiBold,
    Inter_400Regular,
    Inter_600SemiBold,
    Cinzel_600SemiBold,
    Cinzel_800ExtraBold,
  });

  const ready = loaded || !!error;
  useEffect(() => {
    if (ready) SplashScreen.hide();
  }, [ready]);

  // Matches the splash screen (Sunset purple) so there's no flash while fonts load.
  if (!ready) return <View style={{ flex: 1, backgroundColor: "#1A0F24" }} />;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <Game />
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
