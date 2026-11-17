/**
 * The opt-in "Today's Daily Challenge is ready" reminder: local notifications only (no server,
 * no push tokens). We keep a week of one-off reminders scheduled and refresh them whenever the
 * app opens or the Daily is played, so a day you've already played gets no reminder.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";

export const REMINDER_TIMES = [
  { hour: 9, label: "9 AM" },
  { hour: 12, label: "Noon" },
  { hour: 18, label: "6 PM" },
  { hour: 20, label: "8 PM" },
];
export const DEFAULT_REMINDER_HOUR = 18;

const CHANNEL = "daily-challenge";
const DAYS_AHEAD = 7;
const supported = Platform.OS === "ios" || Platform.OS === "android";

/** Asks for permission (the system prompt shows once). Returns whether reminders can be sent. */
export async function allowReminders(): Promise<boolean> {
  if (!supported) return false;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: "Daily Challenge",
        importance: AndroidImportance.DEFAULT,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

export async function cancelReminders() {
  if (!supported) return;
  try {
    await Notifications.cancelAllScheduledNotificationsAsync(); // reminders are our only notifications
  } catch {}
}

/** Replaces the scheduled reminders with the next week's, at `hour` each day. */
export async function scheduleReminders(hour: number, playedToday: boolean, streak: number) {
  if (!supported) return;
  try {
    const perms = await Notifications.getPermissionsAsync();
    if (!perms.granted) return;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const now = new Date();
    for (let day = 0; day < DAYS_AHEAD; day++) {
      const at = new Date(now);
      at.setDate(now.getDate() + day);
      at.setHours(hour, 0, 0, 0);
      if (day === 0 && (playedToday || at <= now)) continue;
      // The streak only holds for the next day or two; after that, keep it general.
      const body =
        streak > 0 && day <= 1
          ? `Keep your ${streak}-day streak going. Same words for everyone today.`
          : "New words, same for everyone. Can you top today's board?";
      await Notifications.scheduleNotificationAsync({
        content: { title: "Today's Daily Challenge is ready", body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: CHANNEL },
      });
    }
  } catch {}
}
