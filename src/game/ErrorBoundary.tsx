/**
 * If something unexpected breaks while drawing the game, show a friendly screen with a Restart
 * button instead of a blank one. Restart starts the game screen fresh at the main menu; saved
 * progress (scores, achievements, Pro, settings) is untouched because it lives in storage.
 */
import { Component, type ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

type Props = { children: ReactNode };
type State = { error: Error | null; attempt: number };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Visible in development; a crash-reporting service would hook in here later.
    console.error("Typo Tyrant hit an error:", error, info.componentStack);
  }

  restart = () => this.setState(s => ({ error: null, attempt: s.attempt + 1 }));

  render() {
    if (!this.state.error) {
      // A new key on each restart remounts the game from scratch.
      return <View key={this.state.attempt} style={styles.fill}>{this.props.children}</View>;
    }
    return (
      <View style={[styles.fill, styles.screen]} accessibilityRole="alert">
        <Image source={require("../../assets/crown.png")} style={styles.crown} accessibilityIgnoresInvertColors />
        <Text style={styles.title}>A typo in the castle</Text>
        <Text style={styles.body}>
          Something went wrong on our side. Your scores, achievements and purchases are safe. Tap below to get back to the
          main menu.
        </Text>
        <Pressable
          onPress={this.restart}
          style={({ pressed }) => [styles.button, pressed && { transform: [{ translateY: 2 }] }]}
          accessibilityRole="button"
        >
          <Text style={styles.buttonText}>RESTART</Text>
        </Pressable>
        {__DEV__ && (
          <Text style={styles.detail} numberOfLines={6}>
            {String(this.state.error?.message ?? this.state.error)}
          </Text>
        )}
      </View>
    );
  }
}

// Fixed Sunset colors: this screen can't rely on the game's theme, which may be what broke.
const styles = StyleSheet.create({
  fill: { flex: 1 },
  screen: { backgroundColor: "#1A0F24", alignItems: "center", justifyContent: "center", padding: 28, gap: 16 },
  crown: { width: 72, height: 44, resizeMode: "contain" },
  title: { fontFamily: "Cinzel_800ExtraBold", fontSize: 26, color: "#FFC94D", textAlign: "center" },
  body: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 22, color: "#B193A8", textAlign: "center", maxWidth: 360 },
  button: {
    marginTop: 8,
    backgroundColor: "#FFC94D",
    borderRadius: 6,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderBottomWidth: 5,
    borderBottomColor: "rgba(0, 0, 0, 0.4)",
  },
  buttonText: { fontFamily: "Cinzel_800ExtraBold", fontSize: 16, letterSpacing: 2, color: "#1A1008" },
  detail: { fontFamily: "Inter_400Regular", fontSize: 11, color: "#57405F", textAlign: "center", maxWidth: 360 },
});
