/** Vibration feedback that follows the Vibration setting. Same calls as expo-haptics. */
import * as Haptics from "expo-haptics";

let enabled = true;

export function setHapticsEnabled(on: boolean) {
  enabled = on;
}

export const buzz = {
  notify: (type: Haptics.NotificationFeedbackType) =>
    enabled ? Haptics.notificationAsync(type) : Promise.resolve(),
  impact: (style: Haptics.ImpactFeedbackStyle) => (enabled ? Haptics.impactAsync(style) : Promise.resolve()),
  select: () => (enabled ? Haptics.selectionAsync() : Promise.resolve()),
};
